// 平台層 API 路由 (Phase 1 Stub)
// Phase 5 會擴充為完整 CRUD
import type { Express } from "express";
import { db } from "../db";
import {
  platformPlans,
  platformFeatureFlags,
  fieldSubscriptions,
  fields,
} from "@shared/schema";
import { requirePlatformAdmin } from "../platformAuth";
import { eq, sql } from "drizzle-orm";

export function registerPlatformRoutes(app: Express): void {
  // ============================================================================
  // 健康檢查 — 確認平台層認證運作
  // ============================================================================
  app.get("/api/platform/health", requirePlatformAdmin, async (req, res) => {
    res.json({
      status: "ok",
      platform: req.platform,
      serverTime: new Date().toISOString(),
    });
  });

  // ============================================================================
  // 平台總覽（儀表板用）
  // ============================================================================
  app.get("/api/platform/overview", requirePlatformAdmin, async (_req, res) => {
    const [fieldsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fields);

    const [plansCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformPlans);

    const [subsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fieldSubscriptions)
      .where(eq(fieldSubscriptions.status, "active"));

    const [flagsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformFeatureFlags);

    res.json({
      fields: fieldsCount?.count ?? 0,
      plans: plansCount?.count ?? 0,
      activeSubscriptions: subsCount?.count ?? 0,
      featureFlags: flagsCount?.count ?? 0,
    });
  });

  // ============================================================================
  // 方案列表（只讀，Phase 5 會加 CRUD）
  // ============================================================================
  app.get("/api/platform/plans", requirePlatformAdmin, async (_req, res) => {
    const plans = await db
      .select()
      .from(platformPlans)
      .orderBy(platformPlans.sortOrder);
    res.json(plans);
  });

  // ============================================================================
  // 功能旗標列表（只讀）
  // ============================================================================
  app.get("/api/platform/feature-flags", requirePlatformAdmin, async (_req, res) => {
    const flags = await db.select().from(platformFeatureFlags);
    res.json(flags);
  });

  // ============================================================================
  // 場域 + 訂閱狀態列表
  // ============================================================================
  app.get("/api/platform/fields", requirePlatformAdmin, async (_req, res) => {
    const rows = await db
      .select({
        field: fields,
        subscription: fieldSubscriptions,
        plan: platformPlans,
      })
      .from(fields)
      .leftJoin(fieldSubscriptions, eq(fieldSubscriptions.fieldId, fields.id))
      .leftJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId));

    res.json(rows);
  });
}
