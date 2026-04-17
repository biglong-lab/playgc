// 📋 場域申請路由 — 公開申請 + 平台審核
import type { Express } from "express";
import { db } from "../db";
import {
  fieldApplications,
  fields,
  fieldSubscriptions,
  platformPlans,
  publicApplicationSchema,
} from "@shared/schema";
import { requirePlatformAdmin } from "../platformAuth";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export function registerApplicationRoutes(app: Express): void {
  // ============================================================================
  // POST /api/apply — 公開申請（不需登入）
  // ============================================================================
  app.post("/api/apply", async (req, res) => {
    const parsed = publicApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "驗證失敗",
        details: parsed.error.errors,
      });
    }

    try {
      // 檢查 email 是否有重複申請（24 小時內）
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await db
        .select()
        .from(fieldApplications)
        .where(eq(fieldApplications.contactEmail, parsed.data.contactEmail))
        .limit(5);

      const hasRecentPending = recent.some(
        (r) =>
          r.status === "pending" &&
          r.createdAt &&
          r.createdAt > oneDayAgo
      );

      if (hasRecentPending) {
        return res.status(429).json({
          error: "您已在 24 小時內送出申請，請耐心等候審核",
        });
      }

      // 場域代碼若有指定，檢查是否已被使用
      if (parsed.data.preferredFieldCode) {
        const existingField = await db.query.fields.findFirst({
          where: eq(fields.code, parsed.data.preferredFieldCode),
        });
        if (existingField) {
          return res.status(409).json({
            error: `場域代碼 "${parsed.data.preferredFieldCode}" 已被使用，請嘗試其他代碼`,
          });
        }
      }

      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        null;
      const referrer = req.headers.referer ?? null;

      const [application] = await db
        .insert(fieldApplications)
        .values({
          ...parsed.data,
          submittedIp: ip,
          referrer,
        })
        .returning();

      res.status(201).json({
        success: true,
        applicationId: application.id,
        message: "申請已送出，我們會在 3 個工作天內與您聯絡",
      });
    } catch (err) {
      console.error("[apply]", err);
      res.status(500).json({ error: "申請失敗，請稍後再試" });
    }
  });

  // ============================================================================
  // GET /api/platform/applications — 平台審核列表
  // ============================================================================
  app.get("/api/platform/applications", requirePlatformAdmin, async (req, res) => {
    const status = req.query.status as string | undefined;
    const query = db
      .select()
      .from(fieldApplications)
      .orderBy(desc(fieldApplications.createdAt))
      .limit(200);

    const rows = status
      ? await db
          .select()
          .from(fieldApplications)
          .where(eq(fieldApplications.status, status))
          .orderBy(desc(fieldApplications.createdAt))
          .limit(200)
      : await query;

    res.json({ applications: rows });
  });

  // ============================================================================
  // GET /api/platform/applications/:id — 申請詳情
  // ============================================================================
  app.get(
    "/api/platform/applications/:id",
    requirePlatformAdmin,
    async (req, res) => {
      const app = await db.query.fieldApplications.findFirst({
        where: eq(fieldApplications.id, req.params.id),
      });
      if (!app) return res.status(404).json({ error: "申請不存在" });
      res.json(app);
    }
  );

  // ============================================================================
  // POST /api/platform/applications/:id/approve — 通過申請（自動開通場域）
  // ============================================================================
  const approveSchema = z.object({
    fieldCode: z.string().regex(/^[A-Z0-9]{3,20}$/, "場域代碼 3-20 字元，僅限大寫英數"),
    fieldName: z.string().min(2).max(200),
    planCode: z.enum(["free", "pro", "enterprise", "revshare"]).default("free"),
    trialDays: z.number().int().min(0).max(90).default(14),
    notes: z.string().optional(),
  });

  app.post(
    "/api/platform/applications/:id/approve",
    requirePlatformAdmin,
    async (req, res) => {
      const parsed = approveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "參數錯誤",
          details: parsed.error.errors,
        });
      }

      const application = await db.query.fieldApplications.findFirst({
        where: eq(fieldApplications.id, req.params.id),
      });
      if (!application) {
        return res.status(404).json({ error: "申請不存在" });
      }
      if (application.status === "approved") {
        return res.status(409).json({ error: "此申請已通過" });
      }

      // 確認場域代碼可用
      const existing = await db.query.fields.findFirst({
        where: eq(fields.code, parsed.data.fieldCode),
      });
      if (existing) {
        return res.status(409).json({ error: "場域代碼已被使用" });
      }

      // 找方案
      const plan = await db.query.platformPlans.findFirst({
        where: eq(platformPlans.code, parsed.data.planCode),
      });
      if (!plan) {
        return res.status(400).json({ error: "方案不存在" });
      }

      try {
        // 1. 建立場域
        const [newField] = await db
          .insert(fields)
          .values({
            code: parsed.data.fieldCode,
            name: parsed.data.fieldName,
            description: application.message ?? null,
            contactEmail: application.contactEmail,
            contactPhone: application.contactPhone,
            address: application.address,
            status: "active",
          })
          .returning();

        // 2. 建立訂閱（含試用期）
        const trialEnd =
          parsed.data.trialDays > 0
            ? new Date(Date.now() + parsed.data.trialDays * 24 * 60 * 60 * 1000)
            : null;
        await db.insert(fieldSubscriptions).values({
          fieldId: newField.id,
          planId: plan.id,
          status: trialEnd ? "trial" : "active",
          billingCycle: "monthly",
          trialEndsAt: trialEnd,
          notes: `自動開通自申請 ${application.id}`,
        });

        // 3. 更新申請狀態
        await db
          .update(fieldApplications)
          .set({
            status: "approved",
            reviewerId: req.platform?.adminAccountId ?? null,
            reviewedAt: new Date(),
            createdFieldId: newField.id,
            adminNotes: parsed.data.notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(fieldApplications.id, req.params.id));

        res.json({
          success: true,
          field: newField,
          trialEndsAt: trialEnd,
        });
      } catch (err) {
        console.error("[approve]", err);
        res.status(500).json({ error: "審核通過失敗" });
      }
    }
  );

  // ============================================================================
  // POST /api/platform/applications/:id/reject — 拒絕申請
  // ============================================================================
  const rejectSchema = z.object({
    reason: z.string().min(2).max(500),
  });

  app.post(
    "/api/platform/applications/:id/reject",
    requirePlatformAdmin,
    async (req, res) => {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "請填寫拒絕原因" });
      }
      const [updated] = await db
        .update(fieldApplications)
        .set({
          status: "rejected",
          rejectionReason: parsed.data.reason,
          reviewerId: req.platform?.adminAccountId ?? null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fieldApplications.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "申請不存在" });
      res.json({ success: true });
    }
  );

  // ============================================================================
  // POST /api/platform/applications/:id/contact — 標記「已聯絡」
  // ============================================================================
  app.post(
    "/api/platform/applications/:id/contact",
    requirePlatformAdmin,
    async (req, res) => {
      const note = typeof req.body?.note === "string" ? req.body.note : null;
      const [updated] = await db
        .update(fieldApplications)
        .set({
          status: "contacted",
          adminNotes: note,
          updatedAt: new Date(),
        })
        .where(eq(fieldApplications.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "申請不存在" });
      res.json({ success: true });
    }
  );
}
