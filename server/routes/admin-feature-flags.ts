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

import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import { featureFlags } from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";

const upsertSchema = z.object({
  scope: z.enum(["global", "field"]).default("global"),
  fieldId: z.string().nullable().optional(),
  moduleKey: z.string().min(1).max(100),
  enabled: z.boolean(),
  disabledReason: z.string().max(50).nullable().optional(),
});

export function registerAdminFeatureFlagsRoutes(app: Express) {
  // ── 列表（admin）
  app.get(
    "/api/admin/feature-flags",
    requireAdminAuth,
    requirePermission("game:view"),
    async (_req, res) => {
      try {
        const rows = await db
          .select()
          .from(featureFlags)
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
        const parsed = upsertSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "請求格式錯誤" });
        }
        const userId =
          (req as { admin?: { id?: string } }).admin?.id ?? "admin";
        const now = new Date();
        const [row] = await db
          .insert(featureFlags)
          .values({
            scope: parsed.data.scope,
            fieldId: parsed.data.fieldId ?? null,
            moduleKey: parsed.data.moduleKey,
            enabled: parsed.data.enabled,
            disabledReason: parsed.data.enabled ? null : (parsed.data.disabledReason ?? "manual"),
            disabledAt: parsed.data.enabled ? null : now,
            disabledBy: parsed.data.enabled ? null : userId,
          })
          .onConflictDoUpdate({
            target: [featureFlags.scope, featureFlags.fieldId, featureFlags.moduleKey],
            set: {
              enabled: parsed.data.enabled,
              disabledReason: parsed.data.enabled ? null : (parsed.data.disabledReason ?? "manual"),
              disabledAt: parsed.data.enabled ? null : now,
              disabledBy: parsed.data.enabled ? null : userId,
              updatedAt: now,
            },
          })
          .returning();
        res.json({ flag: row });
      } catch (err) {
        console.error("[admin-feature-flags] upsert failed:", err);
        res.status(500).json({ error: "internal" });
      }
    },
  );

  // ── 切換 enabled（admin、快速 toggle）
  app.patch(
    "/api/admin/feature-flags/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const enabled = Boolean(req.body.enabled);
        const userId =
          (req as { admin?: { id?: string } }).admin?.id ?? "admin";
        const now = new Date();
        const [row] = await db
          .update(featureFlags)
          .set({
            enabled,
            disabledReason: enabled ? null : (req.body.disabledReason ?? "manual"),
            disabledAt: enabled ? null : now,
            disabledBy: enabled ? null : userId,
            updatedAt: now,
          })
          .where(eq(featureFlags.id, req.params.id))
          .returning();
        if (!row) return res.status(404).json({ error: "flag 不存在" });
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
