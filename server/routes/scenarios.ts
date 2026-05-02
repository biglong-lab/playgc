// 🎯 Scenario Instantiate — 一鍵套用情境模板（W6 D2 + D3）
//
// 端點：
//   POST /api/admin/scenarios/:scenarioId/instantiate
//     一鍵建立情境實例
//
// W6 D2：支援 pure-host 情境
// W6 D3：擴充支援含 multi/solo 元件的混合情境
//
// 邏輯：
//   - host 元件 → 建 game + page + host_session（hostMode=true，hostToken 12h）
//     → 玩家透過 /play/:sessionId 進入、大螢幕透過 /host/:sessionId?token=xxx
//   - multi 元件 → 建 game (gameMode=team) + page + publicSlug
//     → 玩家透過 /g/:slug 進入（隊伍流程）
//   - solo 元件 → 建 game (gameMode=individual) + page + publicSlug
//     → 玩家透過 /g/:slug 進入
//   - shared 元件（如 dialogue/text_card）→ 視為 solo 處理
//
// 為什麼要分開建多個 game？
//   - 每個元件都是一個獨立場次/任務，可分時段啟用
//   - 街區走讀：先 GpsCascade（multi）解鎖點，再 KnowledgeMap（host）總覽

import type { Express } from "express";
import { db } from "../db";
import { games, pages, gameSessions, fields, parseFieldSettings } from "@shared/schema";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import {
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";
import { generateSlug } from "../qrCodeService";
import { generateScenarioContent } from "../lib/scenario-content-generator";
import { decryptApiKey } from "../lib/crypto";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

/** 為每個元件提供預設 page config（最小可玩內容）*/
function getDefaultConfigForPageType(pageType: string, scenarioName: string): Record<string, unknown> {
  switch (pageType) {
    // ─── host 軸線 ───
    case "host_polaroid_collage":
      return { title: `${scenarioName} 紀念牆`, subtitle: "請來賓留下祝福" };
    case "host_guestbook_digital":
      return { title: `${scenarioName} 簽名簿`, subtitle: "歡迎留言" };
    case "host_emoji_react":
      return { title: `${scenarioName} 情緒池` };
    case "host_trivia_showdown":
      return {
        title: `${scenarioName} 搶答`,
        questions: [
          {
            id: "q1",
            prompt: "範例題目：1+1=?",
            options: ["1", "2", "3", "4"],
            correctIdx: 1,
            timeLimitSec: 15,
          },
        ],
      };
    case "host_live_leaderboard":
      return { title: `${scenarioName} 排行榜`, topN: 10 };
    case "host_wave_response":
      return { title: `${scenarioName} 應援` };
    case "host_crowd_gather":
      return { title: `${scenarioName} 簽到`, targetCount: 30 };
    case "host_scoreboard_announcement":
      return { title: `${scenarioName} 即時播報` };
    case "host_knowledge_map":
      return { title: `${scenarioName} 場域地圖` };
    case "host_poll_live":
      return {
        title: `${scenarioName} 即時投票`,
        question: "範例：你最想看哪個橋段？",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
          { id: "c", label: "選項 C" },
        ],
      };

    // ─── multi 軸線 ───
    case "gps_cascade":
      return {
        title: `${scenarioName} 連鎖點`,
        points: [
          { id: "p1", name: "起點", hint: "第一站集合" },
          { id: "p2", name: "中繼站", hint: "依指引前往" },
          { id: "p3", name: "終點", hint: "完成所有任務" },
        ],
      };
    case "treasure_hunt":
      return {
        title: `${scenarioName} 尋寶`,
        finalReward: "🏆 完成獎勵",
        clues: [
          { id: "c1", prompt: "第一道線索（請 admin 編輯）", answer: "答案 1" },
          { id: "c2", prompt: "第二道線索", answer: "答案 2" },
        ],
      };
    case "jigsaw_puzzle":
      return {
        title: `${scenarioName} 拼圖`,
        rows: 2,
        cols: 2,
        prompts: ["紅色方塊", "藍色方塊", "綠色方塊", "黃色方塊"],
      };
    case "collective_score":
      return { title: `${scenarioName} 累計分`, targetScore: 1000 };
    case "role_assign":
      return {
        title: `${scenarioName} 角色分派`,
        subtitle: "你扮演誰？",
        roles: [
          { id: "r1", name: "角色 A", emoji: "🎭", description: "請 admin 編輯角色說明", color: "#3b82f6" },
          { id: "r2", name: "角色 B", emoji: "🕵️", description: "請 admin 編輯角色說明", color: "#10b981" },
          { id: "r3", name: "角色 C", emoji: "👁", description: "請 admin 編輯角色說明", color: "#f59e0b" },
        ],
      };
    case "photo_team":
      return {
        title: `${scenarioName} 團體合影`,
        prompts: ["請大家擺出歡樂的姿勢"],
      };
    case "vote_team":
      return {
        title: `${scenarioName} 隊伍投票`,
        question: "請決定：",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
        ],
        mode: "majority",
      };
    case "shooting_team":
      return { title: `${scenarioName} 隊伍射擊累計` };
    case "gps_team_mission":
      return {
        title: `${scenarioName} 隊伍 GPS`,
        triggerMode: "any",
        targetLocation: { lat: 24.4321, lng: 118.317 },
        radius: 50,
      };
    case "lock_coop":
      return {
        title: `${scenarioName} 協作解鎖`,
        clues: ["線索 1（admin 編輯）", "線索 2", "線索 3"],
        password: "ADMIN_EDIT",
      };
    case "relay_mission":
      return {
        title: `${scenarioName} 接力任務`,
        segments: [
          { id: "s1", description: "第一棒：請 admin 編輯", solverPrompt: "完成這個任務" },
          { id: "s2", description: "第二棒", solverPrompt: "完成這個任務" },
        ],
      };
    case "territory_capture":
      return {
        title: `${scenarioName} 地盤戰`,
        points: [{ id: "t1", name: "據點 A", lat: 24.43, lng: 118.31, radius: 30 }],
      };
    case "choice_verify_race":
      return {
        title: `${scenarioName} 隊伍搶答`,
        question: "範例題目：請編輯",
        options: ["A", "B", "C", "D"],
        correctIdx: 0,
        timeLimitSec: 20,
      };

    // ─── shared / solo（簡單預設）───
    case "dialogue":
      return {
        character: { name: "主持人" },
        messages: [{ text: `歡迎來到 ${scenarioName}` }],
      };
    case "text_card":
      return { title: scenarioName, content: "請 admin 編輯內容" };
    case "video":
      return { url: "" };

    default:
      return { title: scenarioName };
  }
}

/** 依 axis 推導 gameMode */
function getGameModeForComponent(component: ScenarioComponent): "individual" | "team" {
  if (component.axis === "multi") return "team";
  return "individual";
}

export function registerScenarioRoutes(app: Express) {
  /**
   * POST /api/admin/scenarios/:scenarioId/ai-preview
   * Body: { context: string }
   *
   * 用 OpenRouter（DeepSeek）為情境的所有元件生成客製化 config 預覽
   * 不寫入 DB、純 preview，admin 可決定是否套用
   *
   * 需要場域已設定 OpenRouter API key（settings.geminiApiKey 為 sk-or-* 格式）
   */
  app.post(
    "/api/admin/scenarios/:scenarioId/ai-preview",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const scenario = getScenarioById(req.params.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "情境不存在" });
        }

        const context = (req.body?.context ?? "").toString().trim().slice(0, 500);
        if (!context) {
          return res.status(400).json({ error: "請提供 context（活動描述）" });
        }

        // 取場域 OpenRouter API key
        const fieldId = req.admin.fieldId;
        if (!fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "您的帳號未綁定場域、無法使用 AI 服務" });
        }

        if (!fieldId) {
          return res.status(503).json({
            error: "super_admin 暫不支援 AI 預覽（需要綁定場域 API key）",
          });
        }

        const [field] = await db.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
        if (!field) return res.status(404).json({ error: "場域不存在" });

        const settings = parseFieldSettings(field.settings);
        const fieldApiKey = settings.geminiApiKey;
        if (!fieldApiKey) {
          return res.status(503).json({
            error: "此場域尚未設定 OpenRouter API key",
            code: "FIELD_AI_NOT_CONFIGURED",
          });
        }

        let apiKey: string;
        try {
          apiKey = decryptApiKey(fieldApiKey);
        } catch {
          return res.status(500).json({ error: "場域 API key 解密失敗" });
        }

        if (!apiKey.startsWith("sk-or-")) {
          return res.status(400).json({
            error: "AI 預覽功能僅支援 OpenRouter API key",
            code: "REQUIRES_OPENROUTER",
          });
        }

        const generated = await generateScenarioContent({
          apiKey,
          scenarioName: scenario.name,
          context,
          components: scenario.components,
        });

        res.json({
          scenario: {
            id: scenario.id,
            name: scenario.name,
            tagline: scenario.tagline,
          },
          context,
          configs: generated.configs,
          rationale: generated.rationale,
          components: scenario.components.map((c) => ({
            pageType: c.pageType,
            label: c.label,
            role: c.role,
            axis: c.axis,
            hasAiConfig: !!generated.configs[c.pageType],
          })),
        });
      } catch (err) {
        console.error("[scenarios] ai-preview 失敗:", err);
        res.status(500).json({
          error: err instanceof Error ? err.message : "AI 內容生成失敗",
        });
      }
    },
  );

  /**
   * POST /api/admin/scenarios/:scenarioId/instantiate
   * Body: { displayName?: string }
   *
   * 為情境的每個 host_* component 建立一個獨立 game + page + host_session
   * 回傳所有建立的實例 + URLs
   */
  app.post(
    "/api/admin/scenarios/:scenarioId/instantiate",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const scenario = getScenarioById(req.params.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "情境不存在" });
        }

        const fieldId = req.admin.fieldId;
        if (!fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "您的帳號未綁定場域、無法建立 game" });
        }

        const displayName = (req.body?.displayName || scenario.name).slice(0, 100);
        const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);

        const instances: ScenarioInstance[] = [];

        for (const component of scenario.components) {
          await instantiateComponent({
            scenarioId: scenario.id,
            scenarioDisplayName: displayName,
            component,
            fieldId: fieldId ?? null,
            expiresAt,
            collector: instances,
          });
        }

        const hostCount = instances.filter((i) => i.axis === "host").length;
        const multiCount = instances.filter((i) => i.axis === "multi").length;
        const otherCount = instances.length - hostCount - multiCount;

        res.status(201).json({
          scenario: {
            id: scenario.id,
            name: scenario.name,
            tagline: scenario.tagline,
          },
          displayName,
          expiresAt: expiresAt.toISOString(),
          instances,
          totalCreated: instances.length,
          breakdown: { host: hostCount, multi: multiCount, other: otherCount },
        });
      } catch (err) {
        console.error("[scenarios] instantiate 失敗:", err);
        res.status(500).json({ error: "建立情境實例失敗" });
      }
    },
  );
}

interface ScenarioInstance {
  axis: "host" | "multi" | "solo" | "shared";
  gameId: string;
  pageType: string;
  label: string;
  /** host 模式才有：大螢幕端 URL（含 token） */
  hostUrl?: string;
  /** host 模式才有：玩家手機端 URL（用 sessionId） */
  playUrl?: string;
  /** host 模式才有：12h 有效 token */
  hostToken?: string;
  /** host 模式才有：session id */
  sessionId?: string;
  /** multi/solo/shared：玩家入口 URL（用 publicSlug） */
  gameUrl?: string;
  /** multi/solo/shared：public slug */
  publicSlug?: string;
  /** 元件作用描述 */
  role: string;
}

interface InstantiateComponentParams {
  scenarioId: string;
  scenarioDisplayName: string;
  component: ScenarioComponent;
  fieldId: string | null;
  expiresAt: Date;
  collector: ScenarioInstance[];
}

async function instantiateComponent(params: InstantiateComponentParams): Promise<void> {
  const { scenarioDisplayName, component, fieldId, expiresAt, collector } = params;

  const isHost = component.axis === "host";
  const gameMode = getGameModeForComponent(component);
  const slug = isHost ? null : generateSlug();

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `情境模板實例：${component.role}`,
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
    config: getDefaultConfigForPageType(component.pageType, scenarioDisplayName),
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
      sessionId: session.id,
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      hostUrl: `/host/${session.id}?token=${hostToken}`,
      playUrl: `/play/${session.id}`,
      hostToken,
      role: component.role,
    });
  } else {
    collector.push({
      axis: component.axis === "shared" ? "shared" : (component.axis as "multi" | "solo"),
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      gameUrl: `/g/${slug}`,
      publicSlug: slug ?? undefined,
      role: component.role,
    });
  }
}
