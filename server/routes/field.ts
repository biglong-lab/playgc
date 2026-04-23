// 🏢 場域端 API — 場域管理員可看到的 SaaS 資訊
// /api/field/* — 場域自己看自己的訂閱、用量、平台費用
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { requirePlatformAdmin } from "../platformAuth";
import { db } from "../db";
import {
  fieldSubscriptions,
  platformPlans,
  platformTransactions,
  fields,
  parsePlanLimits,
} from "@shared/schema";
import { eq, desc, and, gte, lt } from "drizzle-orm";
import {
  getFieldUsage,
  getFieldPlatformFees,
  generateMonthlyInvoice,
  runMonthlyBilling,
} from "../services/billing";

export function registerFieldRoutes(app: Express): void {
  // ============================================================================
  // GET /api/field/subscription — 我的方案 + 用量
  // ============================================================================
  app.get("/api/field/subscription", requireAdminAuth, async (req, res) => {
    if (!req.admin) return res.status(401).json({ message: "未認證" });

    // 🔒 場域隔離：統一 admin.fieldId
      const fieldId = req.admin.fieldId;

    const row = await db
      .select({
        sub: fieldSubscriptions,
        plan: platformPlans,
      })
      .from(fieldSubscriptions)
      .leftJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId))
      .where(eq(fieldSubscriptions.fieldId, fieldId))
      .limit(1);

    const sub = row[0]?.sub;
    const plan = row[0]?.plan;
    if (!sub) {
      return res.status(404).json({ error: "場域尚未訂閱方案" });
    }

    const usage = await getFieldUsage(fieldId);
    const fees = await getFieldPlatformFees(fieldId);

    const planLimits = plan ? parsePlanLimits(plan.limits) : {};
    const customLimits = (sub.customLimits ?? {}) as Record<string, number>;
    const effectiveLimits = { ...planLimits, ...customLimits };

    res.json({
      subscription: sub,
      plan,
      effectiveLimits,
      usage,
      platformFeesThisMonth: fees,
    });
  });

  // ============================================================================
  // GET /api/field/platform-transactions — 平台費用歷史
  // ============================================================================
  app.get("/api/field/platform-transactions", requireAdminAuth, async (req, res) => {
    if (!req.admin) return res.status(401).json({ message: "未認證" });

    // 🔒 場域隔離：統一 admin.fieldId
      const fieldId = req.admin.fieldId;

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const transactions = await db
      .select()
      .from(platformTransactions)
      .where(eq(platformTransactions.fieldId, fieldId))
      .orderBy(desc(platformTransactions.createdAt))
      .limit(limit);

    res.json({ transactions });
  });

  // ============================================================================
  // POST /api/field/subscription/generate-invoice — 手動產生當月帳單
  // （通常由 cron 觸發，但留一個手動測試端點給平台管理員）
  // ============================================================================
  app.post(
    "/api/field/subscription/generate-invoice",
    requirePlatformAdmin,
    async (req, res) => {
      const { fieldId, month } = req.body as { fieldId?: string; month?: string };
      if (!fieldId) return res.status(400).json({ error: "需指定 fieldId" });

      try {
        const targetMonth = month ? new Date(month) : undefined;
        const result = await generateMonthlyInvoice(fieldId, targetMonth);
        if (!result) {
          return res.json({ success: false, reason: "免費方案或無須計費" });
        }
        res.json({ success: true, ...result });
      } catch (err) {
        console.error("[generate-invoice]", err);
        res.status(500).json({ error: "產生帳單失敗" });
      }
    }
  );

  // ============================================================================
  // POST /api/platform/billing/run — 對所有場域跑月度帳單（平台管理員）
  // ============================================================================
  app.post(
    "/api/platform/billing/run",
    requirePlatformAdmin,
    async (req, res) => {
      const { month } = req.body as { month?: string };
      try {
        const targetMonth = month ? new Date(month) : undefined;
        const result = await runMonthlyBilling(targetMonth);
        res.json(result);
      } catch (err) {
        console.error("[billing/run]", err);
        res.status(500).json({ error: "月度結算失敗" });
      }
    }
  );
}
