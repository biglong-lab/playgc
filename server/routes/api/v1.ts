// 🌐 Public API v1 — 對外開放給代理商整合（W11 D1）
//
// 認證：Authorization: Bearer ck_xxx
// 環境變數：API_KEYS（逗號分隔的有效 key）
//
// 設計依據：docs/decisions/0008-public-api-design.md
//
// W11 D1（read-only）：
//   GET /api/v1/health      公開（不需認證）
//   GET /api/v1/scenarios   列出所有情境
//   GET /api/v1/scenarios/:id  單一情境詳情
//
// W11 D2-W12 規劃：
//   POST /api/v1/instances 建立實例
//   GET /api/v1/instances/:id
//   POST /api/v1/instances/:id/end
//   GET /api/v1/usage

import type { Express } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { requireApiKey } from "../../middleware/api-key";
import { rateLimit } from "../../middleware/rate-limit";
import { idempotency } from "../../middleware/idempotency";
import {
  SCENARIO_TEMPLATES,
  SCENARIO_CATEGORY_LABELS,
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";
import { db } from "../../db";
import { games, pages, gameSessions, fields } from "@shared/schema";
import { generateSlug } from "../../qrCodeService";
import { dispatchWebhook } from "../../lib/webhook-dispatcher";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

// W12 D1: fieldId 改從 req.apiKey.fieldId 直接取（store metadata 已含）
// 既有 getFieldIdForApiKey() 移除、邏輯內聯到 handler

export function registerPublicApiV1Routes(app: Express) {
  /**
   * GET /api/v1/health
   * 公開健康檢查（不需 API key）
   */
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "v1",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/openapi.json
   * 公開 OpenAPI 3.1 規格（W11 D4）
   * 代理商可匯入 Postman / Insomnia / Swagger UI
   */
  app.get("/api/v1/openapi.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json(buildOpenApiSpec(baseUrl));
  });

  /**
   * GET /api/v1/scenarios
   * 列出所有情境（需 API key）
   *
   * Query params:
   *   ?status=live  只列 live
   *   ?category=social  過濾分類
   */
  /**
   * GET /api/v1/keys/me
   * 代理商查自己 API key 的 metadata（不含完整 key）
   */
  app.get("/api/v1/keys/me", requireApiKey, rateLimit, (req, res) => {
    const meta = req.apiKey!;
    res.json({
      object: "api_key_metadata",
      keyId: meta.keyId,
      label: meta.label,
      isTest: meta.isTest,
      fieldId: meta.fieldId,
      quota: meta.quota,
    });
  });

  app.get("/api/v1/scenarios", requireApiKey, rateLimit, (req, res) => {
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    let scenarios = SCENARIO_TEMPLATES;

    if (statusFilter) {
      scenarios = scenarios.filter((s) => s.status === statusFilter);
    }
    if (categoryFilter) {
      scenarios = scenarios.filter((s) => s.category === categoryFilter);
    }

    res.json({
      object: "list",
      total: scenarios.length,
      categoryLabels: SCENARIO_CATEGORY_LABELS,
      data: scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline,
        category: s.category,
        icon: s.icon,
        estimatedPlayers: s.estimatedPlayers,
        estimatedDuration: s.estimatedDuration,
        status: s.status,
        componentCount: s.components.length,
        axes: Array.from(new Set(s.components.map((c) => c.axis))),
        valueProposition: s.valueProposition,
      })),
    });
  });

  /**
   * GET /api/v1/scenarios/:id
   * 單一情境詳情（含完整 components）
   */
  app.get("/api/v1/scenarios/:id", requireApiKey, rateLimit, (req, res) => {
    const scenario = getScenarioById(req.params.id);

    if (!scenario) {
      return res.status(404).json({
        error: {
          code: "scenario_not_found",
          message: `找不到 ID 為 ${req.params.id} 的情境`,
        },
      });
    }

    res.json({
      object: "scenario",
      id: scenario.id,
      name: scenario.name,
      tagline: scenario.tagline,
      description: scenario.description,
      category: scenario.category,
      icon: scenario.icon,
      gradient: scenario.gradient,
      estimatedPlayers: scenario.estimatedPlayers,
      estimatedDuration: scenario.estimatedDuration,
      useCases: scenario.useCases,
      components: scenario.components.map((c) => ({
        pageType: c.pageType,
        label: c.label,
        role: c.role,
        axis: c.axis,
      })),
      valueProposition: scenario.valueProposition,
      status: scenario.status,
    });
  });

  /**
   * POST /api/v1/instances
   * Body: { scenarioId: string, displayName?: string, customerEmail?: string }
   * Header: Idempotency-Key（可選、24h 內防重發）
   *
   * 代理商一鍵建場 — 為情境的所有元件建立 game + page + host_session
   */
  app.post(
    "/api/v1/instances",
    requireApiKey,
    rateLimit,
    idempotency,
    async (req, res) => {
      try {
        const { scenarioId, displayName, customerEmail } = req.body ?? {};
        if (!scenarioId) {
          return res.status(400).json({
            error: { code: "missing_scenario_id", message: "請提供 scenarioId" },
          });
        }

        const scenario = getScenarioById(scenarioId);
        if (!scenario) {
          return res.status(404).json({
            error: {
              code: "scenario_not_found",
              message: `找不到 ID 為 ${scenarioId} 的情境`,
            },
          });
        }

        const fieldId = req.apiKey!.fieldId;
        if (!fieldId) {
          return res.status(400).json({
            error: {
              code: "api_key_not_mapped_to_field",
              message: "您的 API key 未綁定場域，請聯絡業務設定",
              documentation_url: "https://game.homi.cc/api-docs",
            },
          });
        }

        // 驗 fieldId 存在
        const [field] = await db.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
        if (!field) {
          return res.status(404).json({
            error: {
              code: "field_not_found",
              message: "API key 綁定的場域不存在",
            },
          });
        }

        const finalDisplayName = String(displayName || scenario.name).slice(0, 100);
        const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);

        const instances: Array<{
          axis: string;
          gameId: string;
          pageType: string;
          label: string;
          hostUrl?: string;
          playUrl?: string;
          gameUrl?: string;
        }> = [];

        for (const component of scenario.components) {
          await instantiateForApi({
            scenarioId: scenario.id,
            scenarioDisplayName: finalDisplayName,
            component,
            fieldId,
            expiresAt,
            collector: instances,
          });
        }

        const breakdown = {
          host: instances.filter((i) => i.axis === "host").length,
          multi: instances.filter((i) => i.axis === "multi").length,
          other: instances.filter((i) => i.axis !== "host" && i.axis !== "multi").length,
        };

        const responseBody = {
          object: "instance" as const,
          scenario: { id: scenario.id, name: scenario.name },
          displayName: finalDisplayName,
          customerEmail: customerEmail || null,
          expiresAt: expiresAt.toISOString(),
          totalCreated: instances.length,
          breakdown,
          components: instances,
          createdBy: req.apiKey!.keyId,
        };

        // W12 D3: 派送 webhook（fire-and-forget，不阻擋 response）
        dispatchWebhook({
          type: "instance.created",
          data: responseBody as unknown as Record<string, unknown>,
          apiKeyId: req.apiKey!.keyId,
        });

        res.status(201).json(responseBody);
      } catch (err) {
        console.error("[api/v1] POST /instances 失敗:", err);
        res.status(500).json({
          error: {
            code: "internal_error",
            message: err instanceof Error ? err.message : "建立實例失敗",
          },
        });
      }
    },
  );
}

// ════════════════════════════════════════════════════════════════════
// OpenAPI 3.1 規格（W11 D4）
// ════════════════════════════════════════════════════════════════════

function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "CHITO Public API",
      version: "v1",
      description:
        "CHITO 數位遊戲平台對外 API — 讓代理商整合情境模板、自動建場\n\n" +
        "認證：Authorization: Bearer ck_test_xxx 或 ck_live_xxx\n" +
        "速率限制：每 API key 每分鐘 60 次請求\n" +
        "Idempotency：POST 端點可帶 Idempotency-Key header（24 小時內重發回相同結果）",
      contact: {
        name: "CHITO 平台",
        url: "https://game.homi.cc",
      },
    },
    servers: [
      { url: `${baseUrl}/api/v1`, description: "Public API v1" },
    ],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          description: "Bearer token，格式 ck_test_* 或 ck_live_*",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "missing_api_key" },
                message: { type: "string" },
                documentation_url: { type: "string", nullable: true },
              },
              required: ["code", "message"],
            },
          },
        },
        ScenarioListItem: {
          type: "object",
          properties: {
            id: { type: "string", example: "wedding" },
            name: { type: "string", example: "婚禮派對情境包" },
            tagline: { type: "string" },
            category: { type: "string", enum: ["social", "event", "public", "corporate", "venue"] },
            estimatedPlayers: { type: "string" },
            estimatedDuration: { type: "string" },
            status: { type: "string", enum: ["live", "preview", "planned"] },
            componentCount: { type: "integer" },
            axes: { type: "array", items: { type: "string" } },
            valueProposition: { type: "string" },
          },
        },
        Instance: {
          type: "object",
          properties: {
            object: { type: "string", const: "instance" },
            scenario: {
              type: "object",
              properties: { id: { type: "string" }, name: { type: "string" } },
            },
            displayName: { type: "string" },
            customerEmail: { type: "string", nullable: true },
            expiresAt: { type: "string", format: "date-time" },
            totalCreated: { type: "integer" },
            breakdown: {
              type: "object",
              properties: {
                host: { type: "integer" },
                multi: { type: "integer" },
                other: { type: "integer" },
              },
            },
            components: { type: "array", items: { $ref: "#/components/schemas/InstanceComponent" } },
          },
        },
        InstanceComponent: {
          type: "object",
          properties: {
            axis: { type: "string", enum: ["host", "multi", "solo", "shared"] },
            gameId: { type: "string" },
            pageType: { type: "string" },
            label: { type: "string" },
            hostUrl: { type: "string", nullable: true, description: "host 元件才有" },
            playUrl: { type: "string", nullable: true, description: "host 元件才有" },
            gameUrl: { type: "string", nullable: true, description: "multi/solo 元件才有" },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "API health check",
          security: [],
          tags: ["Meta"],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      version: { type: "string" },
                      timestamp: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/scenarios": {
        get: {
          summary: "列出所有情境模板",
          tags: ["Scenarios"],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["live", "preview", "planned"] },
            },
            {
              name: "category",
              in: "query",
              schema: { type: "string", enum: ["social", "event", "public", "corporate", "venue"] },
            },
          ],
          responses: {
            "200": {
              description: "情境列表",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      object: { type: "string", const: "list" },
                      total: { type: "integer" },
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ScenarioListItem" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid API key",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "429": {
              description: "Rate limit exceeded",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/scenarios/{id}": {
        get: {
          summary: "單一情境詳情",
          tags: ["Scenarios"],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "情境詳情" },
            "404": {
              description: "Not found",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/instances": {
        post: {
          summary: "建立情境實例（一鍵建場）",
          tags: ["Instances"],
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              schema: { type: "string" },
              description: "24 小時內重發回相同結果",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["scenarioId"],
                  properties: {
                    scenarioId: { type: "string", example: "wedding" },
                    displayName: { type: "string", example: "Hung & Anita 5/15 婚禮" },
                    customerEmail: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "實例建立成功",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Instance" } } },
            },
            "400": {
              description: "Bad request（缺欄位 / API key 未綁定場域）",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "401": { description: "Missing or invalid API key" },
            "404": { description: "Scenario not found" },
            "429": { description: "Rate limit exceeded" },
          },
        },
      },
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// 內部 helper：API instantiate 元件（與 admin scenarios.ts 邏輯類似）
// ════════════════════════════════════════════════════════════════════

interface InstantiateForApiParams {
  scenarioId: string;
  scenarioDisplayName: string;
  component: ScenarioComponent;
  fieldId: string;
  expiresAt: Date;
  collector: Array<{
    axis: string;
    gameId: string;
    pageType: string;
    label: string;
    hostUrl?: string;
    playUrl?: string;
    gameUrl?: string;
  }>;
}

async function instantiateForApi(params: InstantiateForApiParams): Promise<void> {
  const { scenarioId, scenarioDisplayName, component, fieldId, expiresAt, collector } = params;
  const isHost = component.axis === "host";
  const gameMode = component.axis === "multi" ? "team" : "individual";
  const slug = isHost ? null : generateSlug();

  // 預設 config（簡化版、admin scenarios.ts 有完整 default config helper）
  const config = { title: `${scenarioDisplayName} - ${component.label}` };

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `情境模板實例：${component.role} [scenario:${scenarioId}] [via:api/v1]`,
      fieldId,
      maxPlayers: 100,
      status: "published",
      gameMode,
      publicSlug: slug,
    })
    .returning();

  if (!game) throw new Error("建立 game 失敗");

  await db.insert(pages).values({
    gameId: game.id,
    pageOrder: 1,
    pageType: component.pageType,
    customName: component.label,
    config,
  });

  if (isHost) {
    const hostToken = generateHostToken();
    const [session] = await db
      .insert(gameSessions)
      .values({
        gameId: game.id,
        status: "playing",
        hostMode: true,
        hostToken,
        hostTokenExpiresAt: expiresAt,
      })
      .returning();
    if (!session) throw new Error("建立 host session 失敗");

    collector.push({
      axis: "host",
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      hostUrl: `/host/${session.id}?token=${hostToken}`,
      playUrl: `/play/${session.id}`,
    });
  } else {
    collector.push({
      axis: component.axis,
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      gameUrl: `/g/${slug}`,
    });
  }
}
