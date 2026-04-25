// 場域 admin 獎勵規則管理 API
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.10 §26.13
//
// 端點：
//   GET    /api/admin/rules            — 列出規則
//   POST   /api/admin/rules            — 建規則
//   PATCH  /api/admin/rules/:id        — 編輯
//   DELETE /api/admin/rules/:id        — 軟刪除（isActive = false）
//   GET    /api/admin/rules/:id/stats  — 配額/觸發統計
//
//   GET    /api/admin/coupon-templates — 列出券模板
//   POST   /api/admin/coupon-templates — 建模板
//   PATCH  /api/admin/coupon-templates/:id — 編輯
//
//   POST   /api/admin/rewards/manual   — 手動發券給某隊伍/玩家
//
import type { Express } from "express";
import { db } from "../db";
import {
  rewardConversionRules,
  rewardConversionEvents,
  couponTemplates,
  platformCoupons,
  squadExternalRewards,
} from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";
import { z } from "zod";

export function registerAdminRewardsRoutes(app: Express) {
  // ============================================================================
  // GET /api/admin/rules — 列出規則
  // ============================================================================
  app.get("/api/admin/rules", requireAdminAuth, async (req, res) => {
    try {
      // 🔒 場域隔離：強制只看自己場域；super_admin 可指定查詢任意場域
      const adminFieldId = req.admin?.fieldId;
      const isSuperAdmin = req.admin?.systemRole === "super_admin";
      const fieldId = isSuperAdmin
        ? (req.query.fieldId as string | undefined)
        : adminFieldId;
      const isActive = req.query.isActive === "false" ? false : undefined;

      let where;
      if (fieldId && isActive !== undefined) {
        where = and(
          eq(rewardConversionRules.fieldId, fieldId),
          eq(rewardConversionRules.isActive, isActive),
        );
      } else if (fieldId) {
        where = eq(rewardConversionRules.fieldId, fieldId);
      } else if (isActive !== undefined) {
        where = eq(rewardConversionRules.isActive, isActive);
      }

      const rules = await db
        .select()
        .from(rewardConversionRules)
        .where(where)
        .orderBy(desc(rewardConversionRules.priority), desc(rewardConversionRules.createdAt));

      res.json(rules);
    } catch (error) {
      console.error("[admin-rewards] GET rules 失敗:", error);
      res.status(500).json({ error: "取得規則列表失敗" });
    }
  });

  // ============================================================================
  // POST /api/admin/rules — 建規則
  // ============================================================================
  const createRuleSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    fieldId: z.string().optional(),
    isActive: z.boolean().default(true),
    triggers: z.record(z.string(), z.unknown()),
    rewards: z.array(z.record(z.string(), z.unknown())).min(1),
    quota: z.record(z.string(), z.unknown()).optional(),
    priority: z.number().int().default(0),
    validUntil: z.string().datetime().optional(),
  });

  app.post("/api/admin/rules", requireAdminAuth, async (req, res) => {
    try {
      const parsed = createRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.errors[0]?.message ?? "驗證失敗",
        });
      }
      const data = parsed.data;
      // 🔒 場域隔離：強制使用自己的 fieldId（super_admin 才可指定其他場域）
      const isSuperAdmin = req.admin?.systemRole === "super_admin";
      const fieldId = isSuperAdmin && data.fieldId ? data.fieldId : req.admin?.fieldId;
      const [created] = await db
        .insert(rewardConversionRules)
        .values({
          name: data.name,
          description: data.description,
          fieldId,
          isActive: data.isActive,
          triggers: data.triggers,
          rewards: data.rewards,
          quota: data.quota ?? {},
          priority: data.priority,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[admin-rewards] POST rule 失敗:", error);
      res.status(500).json({ error: "建立規則失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/admin/rules/:id — 編輯規則
  // ============================================================================
  const updateRuleSchema = createRuleSchema.partial();

  app.patch("/api/admin/rules/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const parsed = updateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "格式錯誤" });
      }

      const data = parsed.data;
      const updateValue: Record<string, unknown> = {};
      if (data.name !== undefined) updateValue.name = data.name;
      if (data.description !== undefined) updateValue.description = data.description;
      if (data.fieldId !== undefined) updateValue.fieldId = data.fieldId;
      if (data.isActive !== undefined) updateValue.isActive = data.isActive;
      if (data.triggers !== undefined) updateValue.triggers = data.triggers;
      if (data.rewards !== undefined) updateValue.rewards = data.rewards;
      if (data.quota !== undefined) updateValue.quota = data.quota;
      if (data.priority !== undefined) updateValue.priority = data.priority;
      if (data.validUntil !== undefined) {
        updateValue.validUntil = data.validUntil ? new Date(data.validUntil) : null;
      }

      const [updated] = await db
        .update(rewardConversionRules)
        .set(updateValue)
        .where(eq(rewardConversionRules.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "規則不存在" });
      res.json(updated);
    } catch (error) {
      console.error("[admin-rewards] PATCH rule 失敗:", error);
      res.status(500).json({ error: "更新規則失敗" });
    }
  });

  // ============================================================================
  // DELETE /api/admin/rules/:id — 軟刪除（isActive=false）
  // ============================================================================
  app.delete("/api/admin/rules/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const [updated] = await db
        .update(rewardConversionRules)
        .set({ isActive: false })
        .where(eq(rewardConversionRules.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "規則不存在" });
      res.json({ success: true });
    } catch (error) {
      console.error("[admin-rewards] DELETE rule 失敗:", error);
      res.status(500).json({ error: "刪除規則失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/rules/:id/stats — 規則統計
  // ============================================================================
  app.get("/api/admin/rules/:id/stats", requireAdminAuth, async (req, res) => {
    try {
      const id = req.params.id;

      // 取規則本體
      const [rule] = await db
        .select()
        .from(rewardConversionRules)
        .where(eq(rewardConversionRules.id, id));

      if (!rule) return res.status(404).json({ error: "規則不存在" });

      // 取觸發次數統計（從 events 找 ruleId）
      const [{ totalEvents }] = await db
        .select({ totalEvents: sql<number>`count(*)::int` })
        .from(rewardConversionEvents)
        .where(eq(rewardConversionEvents.status, "processed"));

      // 取本月觸發
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const [{ monthlyEvents }] = await db
        .select({ monthlyEvents: sql<number>`count(*)::int` })
        .from(rewardConversionEvents)
        .where(eq(rewardConversionEvents.status, "processed"));

      res.json({
        rule,
        stats: {
          totalHits: rule.hitsCount,
          totalEvents,
          monthlyEvents,
          quotaRemaining: calcQuotaRemaining(rule),
        },
      });
    } catch (error) {
      console.error("[admin-rewards] GET stats 失敗:", error);
      res.status(500).json({ error: "取得統計失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/rewards/analytics — 獎勵總覽 dashboard（Phase 12 加值）
  //
  // 提供：
  //   - 總獎勵發放次數（含過去 7 / 30 天）
  //   - 平台券 vs 外部券分布
  //   - Top 10 規則命中數
  //   - 兌換率（issued vs redeemed）
  // ============================================================================
  app.get(
    "/api/admin/rewards/analytics",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

        // 1. 總事件數（過去 30 天）
        const events30 = await db
          .select({
            rulesEvaluated: rewardConversionEvents.rulesEvaluated,
            status: rewardConversionEvents.status,
            createdAt: rewardConversionEvents.createdAt,
          })
          .from(rewardConversionEvents)
          .orderBy(desc(rewardConversionEvents.createdAt))
          .limit(5000);

        const totalEvents = events30.length;
        const events7d = events30.filter(
          (e) => e.createdAt && e.createdAt >= sevenDaysAgo,
        ).length;
        const eventsToday = events30.filter(
          (e) =>
            e.createdAt &&
            e.createdAt.toDateString() === now.toDateString(),
        ).length;

        // 2. Top 10 規則命中數（從 rulesEvaluated jsonb 抽 ruleId）
        const ruleHits: Record<string, number> = {};
        for (const e of events30) {
          const rules = (e.rulesEvaluated as Array<{ ruleId?: string }>) ?? [];
          for (const r of rules) {
            if (r?.ruleId) {
              ruleHits[r.ruleId] = (ruleHits[r.ruleId] || 0) + 1;
            }
          }
        }
        const topRuleIds = Object.entries(ruleHits)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        const topRulesData =
          topRuleIds.length > 0
            ? await db
                .select({
                  id: rewardConversionRules.id,
                  name: rewardConversionRules.name,
                  rewards: rewardConversionRules.rewards,
                })
                .from(rewardConversionRules)
                .where(
                  inArray(
                    rewardConversionRules.id,
                    topRuleIds.map(([id]) => id),
                  ),
                )
            : [];

        const topRules = topRuleIds.map(([id, hits]) => {
          const rule = topRulesData.find((r) => r.id === id);
          // rewards 是 jsonb array of { type, ... }
          const firstReward = Array.isArray(rule?.rewards)
            ? (rule!.rewards as Array<{ type?: string }>)[0]
            : null;
          return {
            ruleId: id,
            name: rule?.name ?? "(未知規則)",
            rewardType: firstReward?.type,
            hits,
          };
        });

        // 3. 平台券狀態統計
        const platformCouponStats = await db
          .select({
            status: platformCoupons.status,
            count: sql<number>`count(*)::int`,
          })
          .from(platformCoupons)
          .groupBy(platformCoupons.status);

        // 4. 外部券狀態統計
        const externalRewardStats = await db
          .select({
            status: squadExternalRewards.status,
            count: sql<number>`count(*)::int`,
          })
          .from(squadExternalRewards)
          .groupBy(squadExternalRewards.status);

        // 5. 兌換率（issued / redeemed）
        const platformIssued = platformCouponStats.reduce(
          (sum, s) => sum + (s.count ?? 0),
          0,
        );
        const platformUsed =
          platformCouponStats.find((s) => s.status === "used")?.count ?? 0;
        const externalIssued = externalRewardStats.reduce(
          (sum, s) => sum + (s.count ?? 0),
          0,
        );
        const externalRedeemed =
          externalRewardStats.find((s) => s.status === "redeemed")?.count ?? 0;

        res.json({
          summary: {
            totalEvents30d: totalEvents,
            totalEvents7d: events7d,
            totalEventsToday: eventsToday,
            platformIssued,
            platformUsed,
            externalIssued,
            externalRedeemed,
            platformConversionRate:
              platformIssued > 0
                ? Math.round((platformUsed / platformIssued) * 100)
                : 0,
            externalConversionRate:
              externalIssued > 0
                ? Math.round((externalRedeemed / externalIssued) * 100)
                : 0,
          },
          topRules,
          platformCouponStats,
          externalRewardStats,
        });
      } catch (error) {
        console.error("[admin-rewards] GET analytics 失敗:", error);
        res.status(500).json({ error: "取得分析失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/admin/coupon-templates
  // ============================================================================
  app.get("/api/admin/coupon-templates", requireAdminAuth, async (req, res) => {
    try {
      const isActive = req.query.isActive === "false" ? false : undefined;
      const where = isActive !== undefined ? eq(couponTemplates.isActive, isActive) : undefined;
      const templates = await db
        .select()
        .from(couponTemplates)
        .where(where)
        .orderBy(desc(couponTemplates.createdAt));
      res.json(templates);
    } catch (error) {
      console.error("[admin-rewards] GET templates 失敗:", error);
      res.status(500).json({ error: "取得券模板失敗" });
    }
  });

  // ============================================================================
  // POST /api/admin/coupon-templates
  // ============================================================================
  const createTemplateSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    discountType: z.enum(["amount", "percentage", "free_item"]),
    discountValue: z.number().int().optional(),
    minPurchase: z.number().int().min(0).default(0),
    applicableScope: z.record(z.string(), z.unknown()).optional(),
    validityDays: z.number().int().min(1).default(30),
    isActive: z.boolean().default(true),
  });

  app.post("/api/admin/coupon-templates", requireAdminAuth, async (req, res) => {
    try {
      const parsed = createTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message });
      }
      const [created] = await db
        .insert(couponTemplates)
        .values({
          name: parsed.data.name,
          description: parsed.data.description,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          minPurchase: parsed.data.minPurchase,
          applicableScope: parsed.data.applicableScope ?? {},
          validityDays: parsed.data.validityDays,
          isActive: parsed.data.isActive,
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[admin-rewards] POST template 失敗:", error);
      res.status(500).json({ error: "建立券模板失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/admin/coupon-templates/:id
  // ============================================================================
  app.patch("/api/admin/coupon-templates/:id", requireAdminAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const parsed = createTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "格式錯誤" });
      }

      const updateValue: Record<string, unknown> = {};
      const data = parsed.data;
      if (data.name !== undefined) updateValue.name = data.name;
      if (data.description !== undefined) updateValue.description = data.description;
      if (data.discountType !== undefined) updateValue.discountType = data.discountType;
      if (data.discountValue !== undefined) updateValue.discountValue = data.discountValue;
      if (data.minPurchase !== undefined) updateValue.minPurchase = data.minPurchase;
      if (data.applicableScope !== undefined) updateValue.applicableScope = data.applicableScope;
      if (data.validityDays !== undefined) updateValue.validityDays = data.validityDays;
      if (data.isActive !== undefined) updateValue.isActive = data.isActive;

      const [updated] = await db
        .update(couponTemplates)
        .set(updateValue)
        .where(eq(couponTemplates.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "券模板不存在" });
      res.json(updated);
    } catch (error) {
      console.error("[admin-rewards] PATCH template 失敗:", error);
      res.status(500).json({ error: "更新券模板失敗" });
    }
  });

  // ============================================================================
  // POST /api/admin/rewards/manual — 手動發券（給特定使用者）
  // ============================================================================
  const manualSchema = z.object({
    userId: z.string().min(1),
    squadId: z.string().optional(),
    templateId: z.string().min(1),
    reason: z.string().optional(),
  });

  app.post("/api/admin/rewards/manual", requireAdminAuth, async (req, res) => {
    try {
      const parsed = manualSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "格式錯誤" });
      }

      const [tpl] = await db
        .select()
        .from(couponTemplates)
        .where(eq(couponTemplates.id, parsed.data.templateId));

      if (!tpl) return res.status(404).json({ error: "券模板不存在" });

      // 產生 8 碼券碼
      const code = generateCouponCode();
      const validityDays = tpl.validityDays ?? 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);

      const [created] = await db
        .insert(platformCoupons)
        .values({
          code,
          templateId: parsed.data.templateId,
          issuedToUserId: parsed.data.userId,
          issuedToSquadId: parsed.data.squadId,
          expiresAt,
          redemptionContext: {
            manualReason: parsed.data.reason,
            issuedBy: "admin",
          },
        })
        .returning();

      res.status(201).json({ success: true, coupon: created });
    } catch (error) {
      console.error("[admin-rewards] POST manual 失敗:", error);
      res.status(500).json({ error: "手動發券失敗" });
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

function calcQuotaRemaining(rule: { hitsCount: number; quota: unknown }): number | "unlimited" {
  const quota = (rule.quota as { totalCap?: number }) ?? {};
  if (quota.totalCap === undefined) return "unlimited";
  return Math.max(0, quota.totalCap - rule.hitsCount);
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
