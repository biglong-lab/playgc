// 🎚️ Admin Feature Flags — 元件遠端開關（Phase 4 / 2026-05-12）
//
// 端點：
//   GET   /api/admin/feature-flags         列出所有 flag
//   PATCH /api/admin/feature-flags/:id     更新 enabled / reason
//   POST  /api/admin/feature-flags         新增 flag
//   GET   /api/feature-flags/check         玩家端查詢（公開、無 auth）
//
// 公開 endpoint 給 GamePageRenderer 用：判斷某元件是否啟用
// 自動降級：cron / endpoint 撈 component_runs 算失敗率

import type { Express, Request } from "express";
import { z } from "zod";
import { db } from "../db";
import { featureFlags } from "@shared/schema";
import { eq, sql, and, or, isNull, desc, type SQL } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction, type AdminPrincipal } from "../adminAuth";

// 🔒 2026-09-23 P0-B：以前場域管理員能新增 / 切換「全域」開關（等於關掉所有場域的元件）
//   現在：非 super_admin 只能新增 / 修改「自己場域」的覆寫；碰全域或別場域 → 403
//   super_admin 行為不變（沒帶 scope 仍預設 global）
const upsertSchema = z.object({
  scope: z.enum(["global", "field"]).optional(),
  fieldId: z.string().min(1).max(100).nullable().optional(),
  moduleKey: z.string().min(1).max(100),
  enabled: z.boolean(),
  disabledReason: z.string().max(50).nullable().optional(),
});

const patchSchema = z.object({
  enabled: z.boolean(),
  disabledReason: z.string().max(50).nullable().optional(),
});

type FlagScope = "global" | "field";
interface FlagTarget { scope: FlagScope; fieldId: string | null }
type FlagRow = typeof featureFlags.$inferSelect;

const GLOBAL_FORBIDDEN = "全域開關會影響所有場域，只有平台管理員可以設定";
const OTHER_FIELD_FORBIDDEN = "只能設定自己場域的元件開關";

function isSuperAdmin(admin: AdminPrincipal): boolean {
  return admin.systemRole === "super_admin";
}

/** 決定寫入範圍；非 super_admin 碰全域 / 別場域回傳 forbidden 訊息 */
function resolveTarget(
  admin: AdminPrincipal,
  body: z.infer<typeof upsertSchema>,
): FlagTarget | { forbidden: string } {
  const superAdmin = isSuperAdmin(admin);
  const scope: FlagScope = body.scope ?? (superAdmin ? "global" : "field");
  if (scope === "global") {
    return superAdmin ? { scope, fieldId: null } : { forbidden: GLOBAL_FORBIDDEN };
  }
  const fieldId = body.fieldId ?? admin.fieldId;
  if (!superAdmin && fieldId !== admin.fieldId) return { forbidden: OTHER_FIELD_FORBIDDEN };
  return { scope, fieldId };
}

/** 非 super_admin 只能改自己場域的覆寫 */
function forbiddenReason(admin: AdminPrincipal, row: FlagRow): string | null {
  if (isSuperAdmin(admin)) return null;
  if (row.scope !== "field") return GLOBAL_FORBIDDEN;
  return row.fieldId === admin.fieldId ? null : OTHER_FIELD_FORBIDDEN;
}

/** 列表篩選：非 super_admin 只看全域（唯讀參考）+ 自己場域 */
function listFilter(admin: AdminPrincipal): SQL | undefined {
  if (isSuperAdmin(admin)) return undefined;
  return or(
    eq(featureFlags.scope, "global"),
    and(eq(featureFlags.scope, "field"), eq(featureFlags.fieldId, admin.fieldId)),
  );
}

function flagState(enabled: boolean, reason: string | null | undefined, userId: string, now: Date) {
  return {
    enabled,
    disabledReason: enabled ? null : (reason ?? "manual"),
    disabledAt: enabled ? null : now,
    disabledBy: enabled ? null : userId,
  };
}

/**
 * 同 scope + fieldId + moduleKey 有就更新、沒有就新增。
 * 不用 ON CONFLICT：DB 唯一索引是 (scope, COALESCE(field_id,''), module_key) 表達式索引，
 * ON CONFLICT (scope, field_id, module_key) 推論不到 → Postgres 直接報錯（以前 POST 一律 500）。
 */
async function upsertFlag(target: FlagTarget, moduleKey: string, state: ReturnType<typeof flagState>, now: Date) {
  const fieldCond = target.fieldId === null
    ? isNull(featureFlags.fieldId)
    : eq(featureFlags.fieldId, target.fieldId);
  const [existing] = await db
    .select()
    .from(featureFlags)
    .where(and(eq(featureFlags.scope, target.scope), fieldCond, eq(featureFlags.moduleKey, moduleKey)))
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(featureFlags)
      .set({ ...state, updatedAt: now })
      .where(eq(featureFlags.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(featureFlags)
    .values({ scope: target.scope, fieldId: target.fieldId, moduleKey, ...state })
    .returning();
  return row;
}

function auditMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export function registerAdminFeatureFlagsRoutes(app: Express) {
  // ── 列表（admin；非 super_admin 只看全域 + 自己場域）
  app.get(
    "/api/admin/feature-flags",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const rows = await db
          .select()
          .from(featureFlags)
          .where(listFilter(req.admin))
          .orderBy(desc(featureFlags.updatedAt));
        res.json({ flags: rows });
      } catch (err) {
        console.error("[admin-feature-flags] list failed:", err);
        res.status(500).json({ error: "internal" });
      }
    },
  );

  // ── 新增 / Upsert（admin）
  app.post(
    "/api/admin/feature-flags",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const parsed = upsertSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "請求格式錯誤" });
        }
        const target = resolveTarget(req.admin, parsed.data);
        if ("forbidden" in target) {
          return res.status(403).json({ error: "forbidden", message: target.forbidden });
        }
        const { moduleKey, enabled, disabledReason } = parsed.data;
        const now = new Date();
        const row = await upsertFlag(target, moduleKey, flagState(enabled, disabledReason, req.admin.id, now), now);

        logAuditAction({
          actorAdminId: req.admin.id,
          action: "feature_flag:upsert",
          targetType: "feature_flag",
          targetId: row.id,
          fieldId: target.fieldId ?? undefined,
          metadata: { moduleKey, scope: target.scope, enabled, disabledReason: disabledReason ?? null },
          ...auditMeta(req),
        });

        res.json({ flag: row });
      } catch (err) {
        console.error("[admin-feature-flags] upsert failed:", err);
        res.status(500).json({ error: "internal" });
      }
    },
  );

  // ── 切換 enabled（admin、快速 toggle；非 super_admin 只能切自己場域的覆寫）
  app.patch(
    "/api/admin/feature-flags/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "請求格式錯誤" });
        }
        const [existing] = await db
          .select()
          .from(featureFlags)
          .where(eq(featureFlags.id, req.params.id))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "flag 不存在" });

        const forbidden = forbiddenReason(req.admin, existing);
        if (forbidden) return res.status(403).json({ error: "forbidden", message: forbidden });

        const { enabled, disabledReason } = parsed.data;
        const now = new Date();
        const [row] = await db
          .update(featureFlags)
          .set({ ...flagState(enabled, disabledReason, req.admin.id, now), updatedAt: now })
          .where(eq(featureFlags.id, existing.id))
          .returning();

        logAuditAction({
          actorAdminId: req.admin.id,
          action: enabled ? "feature_flag:enable" : "feature_flag:disable",
          targetType: "feature_flag",
          targetId: row.id,
          fieldId: row.fieldId ?? undefined,
          metadata: {
            moduleKey: row.moduleKey,
            scope: row.scope,
            disabledReason: enabled ? null : (disabledReason ?? "manual"),
          },
          ...auditMeta(req),
        });

        res.json({ flag: row });
      } catch (err) {
        console.error("[admin-feature-flags] patch failed:", err);
        res.status(500).json({ error: "internal" });
      }
    },
  );

  // ── 公開 endpoint（玩家端用）
  //   GET /api/feature-flags/check?moduleKey=trivia_showdown&fieldId=xxx
  //   回傳 { enabled: boolean, disabledReason?: string }
  app.get("/api/feature-flags/check", async (req, res) => {
    try {
      const moduleKey = String(req.query.moduleKey ?? "");
      const fieldId = req.query.fieldId ? String(req.query.fieldId) : null;
      if (!moduleKey) return res.json({ enabled: true });

      // 優先 field-level、fallback global
      const fieldRows = fieldId
        ? await db
            .select()
            .from(featureFlags)
            .where(
              and(
                eq(featureFlags.scope, "field"),
                eq(featureFlags.fieldId, fieldId),
                eq(featureFlags.moduleKey, moduleKey),
              ),
            )
            .limit(1)
        : [];
      if (fieldRows[0]) {
        return res.json({
          enabled: fieldRows[0].enabled,
          disabledReason: fieldRows[0].disabledReason,
        });
      }
      const globalRows = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.scope, "global"),
            eq(featureFlags.moduleKey, moduleKey),
          ),
        )
        .limit(1);
      if (globalRows[0]) {
        return res.json({
          enabled: globalRows[0].enabled,
          disabledReason: globalRows[0].disabledReason,
        });
      }
      // 預設 enabled
      res.json({ enabled: true });
    } catch (err) {
      console.error("[admin-feature-flags] check failed:", err);
      res.json({ enabled: true }); // fail-open（不擋玩家）
    }
  });

  // ── 自動降級偵測（cron 觸發）
  //   POST /api/cron/auto-disable-failed-components
  //   撈過去 1h 各元件失敗率、> 50% 自動標 disabled
  app.post("/api/cron/auto-disable-failed-components", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Invalid cron token" });
    }
    try {
      // 撈過去 1h 各 componentType 統計（樣本 >= 10 才算）
      const stats = await db.execute<{
        component_type: string;
        total: string;
        errored: string;
      }>(sql`
        SELECT
          component_type,
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE final_state = 'errored')::text AS errored
        FROM component_runs
        WHERE mounted_at >= NOW() - INTERVAL '1 hour'
        GROUP BY component_type
        HAVING COUNT(*) >= 10
      `);
      const rows = (stats as unknown as { rows?: Array<{ component_type: string; total: string; errored: string }> }).rows ?? [];

      const autoDisabled: string[] = [];
      const autoEnabled: string[] = [];
      const now = new Date();

      for (const row of rows) {
        const total = parseInt(row.total, 10);
        const errored = parseInt(row.errored, 10);
        const failRate = total > 0 ? errored / total : 0;
        const shouldDisable = failRate > 0.5;

        const existing = await db
          .select()
          .from(featureFlags)
          .where(
            and(
              eq(featureFlags.scope, "global"),
              eq(featureFlags.moduleKey, row.component_type),
            ),
          )
          .limit(1);

        if (shouldDisable && !existing[0]) {
          // 新增 disabled flag
          await db.insert(featureFlags).values({
            scope: "global",
            moduleKey: row.component_type,
            enabled: false,
            disabledReason: "auto:high_failure",
            disabledAt: now,
            disabledBy: "system",
            metrics: { failRate, total, errored, window: "1h" },
          });
          autoDisabled.push(row.component_type);
        } else if (shouldDisable && existing[0]?.enabled) {
          // 既有 flag 但 enabled → 改 disabled
          await db
            .update(featureFlags)
            .set({
              enabled: false,
              disabledReason: "auto:high_failure",
              disabledAt: now,
              disabledBy: "system",
              metrics: { failRate, total, errored, window: "1h" },
              updatedAt: now,
            })
            .where(eq(featureFlags.id, existing[0].id));
          autoDisabled.push(row.component_type);
        } else if (!shouldDisable && existing[0] && !existing[0].enabled && existing[0].disabledReason?.startsWith("auto:")) {
          // 既有 auto-disabled、現在恢復健康 → 自動 re-enable（manual disabled 不動）
          await db
            .update(featureFlags)
            .set({
              enabled: true,
              disabledReason: null,
              disabledAt: null,
              disabledBy: null,
              metrics: { failRate, total, errored, window: "1h", recovered: true },
              updatedAt: now,
            })
            .where(eq(featureFlags.id, existing[0].id));
          autoEnabled.push(row.component_type);
        }
      }

      res.json({
        ok: true,
        timestamp: now.toISOString(),
        analyzed: rows.length,
        autoDisabled,
        autoEnabled,
      });
    } catch (err) {
      console.error("[admin-feature-flags] auto-disable failed:", err);
      res.status(500).json({ error: "internal" });
    }
  });
}
