// 🌐 平台層 API 路由 (Phase 5 完整實作)
import type { Express } from "express";
import { db } from "../db";
import {
  platformPlans,
  platformFeatureFlags,
  fieldFeatureOverrides,
  fieldSubscriptions,
  platformTransactions,
  fields,
  adminAccounts,
  roles,
  permissions,
  rolePermissions,
  aiUsageLogs,
  fieldUsageMeters,
  errorLogs,
  platformIpWhitelist,
  insertPlatformPlanSchema,
  insertPlatformFeatureFlagSchema,
  insertFieldFeatureOverrideSchema,
} from "@shared/schema";
import { requirePlatformAdmin } from "../platformAuth";
import { logAuditAction } from "../adminAuth";
import { scanBillingAlerts, getBillingAlertSummary } from "../lib/billing-alerts";
import { auditLogs, adminAccounts as adminAccountsTable } from "@shared/schema";
import { eq, sql, desc, and, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小時 ${Math.floor((seconds % 3600) / 60)} 分`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days} 天 ${hours} 小時`;
}

export function registerPlatformRoutes(app: Express): void {
  // ============================================================================
  // 健康檢查
  // ============================================================================
  app.get("/api/platform/health", requirePlatformAdmin, async (req, res) => {
    res.json({
      status: "ok",
      platform: req.platform,
      serverTime: new Date().toISOString(),
    });
  });

  // ============================================================================
  // 📊 平台總覽
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

    // 本月平台收入
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthlyRevenue] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${platformTransactions.status} = 'paid' THEN ${platformTransactions.amount} ELSE 0 END), 0)::int`,
        count: sql<number>`COUNT(CASE WHEN ${platformTransactions.status} = 'paid' THEN 1 END)::int`,
      })
      .from(platformTransactions)
      .where(sql`${platformTransactions.createdAt} >= ${monthStart}`);

    res.json({
      fields: fieldsCount?.count ?? 0,
      plans: plansCount?.count ?? 0,
      activeSubscriptions: subsCount?.count ?? 0,
      featureFlags: flagsCount?.count ?? 0,
      monthlyRevenue: monthlyRevenue?.total ?? 0,
      monthlyTransactionCount: monthlyRevenue?.count ?? 0,
    });
  });

  // ============================================================================
  // 📦 方案管理（CRUD）
  // ============================================================================
  app.get("/api/platform/plans", requirePlatformAdmin, async (_req, res) => {
    const plans = await db.select().from(platformPlans).orderBy(platformPlans.sortOrder);
    res.json(plans);
  });

  app.post("/api/platform/plans", requirePlatformAdmin, async (req, res) => {
    const parsed = insertPlatformPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    try {
      const [plan] = await db.insert(platformPlans).values(parsed.data).returning();
      res.status(201).json(plan);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: `方案代碼 "${parsed.data.code}" 已存在` });
      }
      throw err;
    }
  });

  app.patch("/api/platform/plans/:id", requirePlatformAdmin, async (req, res) => {
    const updateSchema = insertPlatformPlanSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    const [plan] = await db
      .update(platformPlans)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(platformPlans.id, req.params.id))
      .returning();
    if (!plan) return res.status(404).json({ error: "方案不存在" });
    res.json(plan);
  });

  app.delete("/api/platform/plans/:id", requirePlatformAdmin, async (req, res) => {
    // 檢查是否有訂閱綁定
    const [inUse] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fieldSubscriptions)
      .where(eq(fieldSubscriptions.planId, req.params.id));
    if ((inUse?.count ?? 0) > 0) {
      return res.status(409).json({ error: `有 ${inUse.count} 個場域訂閱此方案，無法刪除` });
    }
    const deleted = await db
      .delete(platformPlans)
      .where(eq(platformPlans.id, req.params.id))
      .returning();
    if (!deleted.length) return res.status(404).json({ error: "方案不存在" });
    res.json({ success: true });
  });

  // ============================================================================
  // 🚩 功能旗標管理（CRUD）
  // ============================================================================
  app.get("/api/platform/feature-flags", requirePlatformAdmin, async (_req, res) => {
    const flags = await db.select().from(platformFeatureFlags);
    res.json(flags);
  });

  app.post("/api/platform/feature-flags", requirePlatformAdmin, async (req, res) => {
    const parsed = insertPlatformFeatureFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    try {
      const [flag] = await db.insert(platformFeatureFlags).values(parsed.data).returning();
      res.status(201).json(flag);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: `旗標 "${parsed.data.flagKey}" 已存在` });
      }
      throw err;
    }
  });

  app.patch("/api/platform/feature-flags/:id", requirePlatformAdmin, async (req, res) => {
    const updateSchema = insertPlatformFeatureFlagSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    const [flag] = await db
      .update(platformFeatureFlags)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(platformFeatureFlags.id, req.params.id))
      .returning();
    if (!flag) return res.status(404).json({ error: "旗標不存在" });
    res.json(flag);
  });

  app.delete("/api/platform/feature-flags/:id", requirePlatformAdmin, async (req, res) => {
    const deleted = await db
      .delete(platformFeatureFlags)
      .where(eq(platformFeatureFlags.id, req.params.id))
      .returning();
    if (!deleted.length) return res.status(404).json({ error: "旗標不存在" });
    res.json({ success: true });
  });

  // ============================================================================
  // 🎛️ 場域功能覆寫
  // ============================================================================
  app.get("/api/platform/fields/:fieldId/overrides", requirePlatformAdmin, async (req, res) => {
    const overrides = await db
      .select()
      .from(fieldFeatureOverrides)
      .where(eq(fieldFeatureOverrides.fieldId, req.params.fieldId));
    res.json(overrides);
  });

  app.post("/api/platform/fields/:fieldId/overrides", requirePlatformAdmin, async (req, res) => {
    const data = { ...req.body, fieldId: req.params.fieldId };
    const parsed = insertFieldFeatureOverrideSchema.safeParse(data);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    try {
      const [override] = await db
        .insert(fieldFeatureOverrides)
        .values({ ...parsed.data, createdBy: req.platform?.adminAccountId ?? null })
        .returning();
      res.status(201).json(override);
    } catch (err: any) {
      if (err?.code === "23505") {
        // 已存在，改用 update
        const [existing] = await db
          .update(fieldFeatureOverrides)
          .set({
            enabled: parsed.data.enabled,
            reason: parsed.data.reason,
            expiresAt: parsed.data.expiresAt,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(fieldFeatureOverrides.fieldId, req.params.fieldId),
              eq(fieldFeatureOverrides.flagKey, parsed.data.flagKey)
            )
          )
          .returning();
        return res.json(existing);
      }
      throw err;
    }
  });

  app.delete("/api/platform/fields/:fieldId/overrides/:flagKey", requirePlatformAdmin, async (req, res) => {
    await db
      .delete(fieldFeatureOverrides)
      .where(
        and(
          eq(fieldFeatureOverrides.fieldId, req.params.fieldId),
          eq(fieldFeatureOverrides.flagKey, req.params.flagKey)
        )
      );
    res.json({ success: true });
  });

  // ============================================================================
  // 🏢 場域管理（列表 + 狀態控制 + 方案變更）
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

  const changeFieldStatusSchema = z.object({
    status: z.enum(["active", "inactive", "suspended"]),
    reason: z.string().optional(),
  });

  app.patch("/api/platform/fields/:id/status", requirePlatformAdmin, async (req, res) => {
    const parsed = changeFieldStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    // 取舊狀態（給 audit 用）
    const oldField = await db.query.fields.findFirst({ where: eq(fields.id, req.params.id) });
    const [field] = await db
      .update(fields)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(fields.id, req.params.id))
      .returning();
    if (!field) return res.status(404).json({ error: "場域不存在" });
    // 🆕 稽核日誌
    await logAuditAction({
      actorAdminId: req.platform?.adminAccountId ?? undefined,
      action: "platform:field_status_change",
      targetType: "field",
      targetId: field.id,
      fieldId: field.id,
      metadata: {
        oldStatus: oldField?.status,
        newStatus: parsed.data.status,
        reason: parsed.data.reason,
        actorRole: req.platform?.role,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json(field);
  });

  const changePlanSchema = z.object({
    planId: z.string(),
    billingCycle: z.enum(["monthly", "yearly"]).optional(),
  });

  app.patch("/api/platform/fields/:id/plan", requirePlatformAdmin, async (req, res) => {
    const parsed = changePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
    }
    // 確認方案存在
    const plan = await db.query.platformPlans.findFirst({
      where: eq(platformPlans.id, parsed.data.planId),
    });
    if (!plan) return res.status(404).json({ error: "方案不存在" });

    // 建立或更新訂閱
    const existing = await db.query.fieldSubscriptions.findFirst({
      where: eq(fieldSubscriptions.fieldId, req.params.id),
    });
    let resultSub;
    let actionType = "platform:field_plan_create";
    if (existing) {
      const [sub] = await db
        .update(fieldSubscriptions)
        .set({
          planId: parsed.data.planId,
          billingCycle: parsed.data.billingCycle ?? existing.billingCycle,
          updatedAt: new Date(),
        })
        .where(eq(fieldSubscriptions.id, existing.id))
        .returning();
      resultSub = sub;
      actionType = "platform:field_plan_change";
    } else {
      const [sub] = await db
        .insert(fieldSubscriptions)
        .values({
          fieldId: req.params.id,
          planId: parsed.data.planId,
          status: "active",
          billingCycle: parsed.data.billingCycle ?? "monthly",
        })
        .returning();
      resultSub = sub;
    }
    // 🆕 稽核日誌
    await logAuditAction({
      actorAdminId: req.platform?.adminAccountId ?? undefined,
      action: actionType,
      targetType: "field_subscription",
      targetId: resultSub.id,
      fieldId: req.params.id,
      metadata: {
        oldPlanId: existing?.planId,
        newPlanId: parsed.data.planId,
        planCode: plan.code,
        planName: plan.name,
        billingCycle: parsed.data.billingCycle ?? "monthly",
        actorRole: req.platform?.role,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json(resultSub);
  });

  // ============================================================================
  // 💵 平台營收
  // ============================================================================
  app.get("/api/platform/revenue", requirePlatformAdmin, async (_req, res) => {
    // 最近 12 個月的每月收入
    const monthly = await db.execute<{
      month: string;
      total: number;
      by_type: Record<string, number>;
    }>(sql`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::int AS total,
        jsonb_object_agg(
          type,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::int
        ) AS by_type
      FROM platform_transactions
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1 DESC
    `);

    // 累計統計
    const [totals] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${platformTransactions.status} = 'paid' THEN ${platformTransactions.amount} ELSE 0 END), 0)::int`,
        pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN ${platformTransactions.status} = 'pending' THEN ${platformTransactions.amount} ELSE 0 END), 0)::int`,
      })
      .from(platformTransactions);

    res.json({
      totalRevenue: totals?.totalRevenue ?? 0,
      pendingAmount: totals?.pendingAmount ?? 0,
      monthly: monthly.rows,
    });
  });

  app.get("/api/platform/transactions", requirePlatformAdmin, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await db
      .select({
        transaction: platformTransactions,
        field: fields,
      })
      .from(platformTransactions)
      .leftJoin(fields, eq(platformTransactions.fieldId, fields.id))
      .orderBy(desc(platformTransactions.createdAt))
      .limit(limit);
    res.json(rows);
  });

  // ============================================================================
  // 📊 跨場域分析（Phase A-1.3）
  // ============================================================================
  app.get("/api/platform/analytics", requirePlatformAdmin, async (_req, res) => {
    // 每個場域的遊戲數 + 本月結帳數 + 本月對戰時段數 + 本月平台費
    const fieldStats = await db.execute<{
      field_id: string;
      field_code: string;
      field_name: string;
      plan_code: string | null;
      games_count: number;
      checkouts_this_month: number;
      battle_slots_this_month: number;
      platform_fees_this_month: number;
      created_at: string;
    }>(sql`
      SELECT
        f.id AS field_id,
        f.code AS field_code,
        f.name AS field_name,
        pp.code AS plan_code,
        COALESCE((SELECT COUNT(*)::int FROM games g WHERE g.field_id = f.id), 0) AS games_count,
        COALESCE(meter_checkouts.current_value, 0) AS checkouts_this_month,
        COALESCE(meter_battles.current_value, 0) AS battle_slots_this_month,
        COALESCE((
          SELECT SUM(amount)::int FROM platform_transactions pt
          WHERE pt.field_id = f.id
            AND pt.type = 'transaction_fee'
            AND pt.created_at >= date_trunc('month', NOW())
        ), 0) AS platform_fees_this_month,
        to_char(f.created_at, 'YYYY-MM-DD') AS created_at
      FROM fields f
      LEFT JOIN field_subscriptions fs ON fs.field_id = f.id
      LEFT JOIN platform_plans pp ON pp.id = fs.plan_id
      LEFT JOIN field_usage_meters meter_checkouts ON meter_checkouts.field_id = f.id
        AND meter_checkouts.meter_key = 'checkouts'
        AND meter_checkouts.period_start >= date_trunc('month', NOW())
        AND meter_checkouts.period_start < date_trunc('month', NOW()) + INTERVAL '1 month'
      LEFT JOIN field_usage_meters meter_battles ON meter_battles.field_id = f.id
        AND meter_battles.meter_key = 'battle_slots'
        AND meter_battles.period_start >= date_trunc('month', NOW())
        AND meter_battles.period_start < date_trunc('month', NOW()) + INTERVAL '1 month'
      ORDER BY platform_fees_this_month DESC NULLS LAST, games_count DESC
    `);

    // 全平台總計
    const [totals] = await db
      .select({
        fieldsCount: sql<number>`COUNT(DISTINCT ${fields.id})::int`,
      })
      .from(fields);

    const [monthlyTotals] = await db
      .select({
        totalFees: sql<number>`COALESCE(SUM(CASE WHEN ${platformTransactions.type} = 'transaction_fee' AND ${platformTransactions.status} = 'paid' THEN ${platformTransactions.amount} ELSE 0 END), 0)::int`,
        pendingFees: sql<number>`COALESCE(SUM(CASE WHEN ${platformTransactions.type} = 'transaction_fee' AND ${platformTransactions.status} = 'pending' THEN ${platformTransactions.amount} ELSE 0 END), 0)::int`,
      })
      .from(platformTransactions)
      .where(sql`${platformTransactions.createdAt} >= date_trunc('month', NOW())`);

    res.json({
      fields: fieldStats.rows,
      summary: {
        fieldsCount: totals?.fieldsCount ?? 0,
        monthlyTotalFees: monthlyTotals?.totalFees ?? 0,
        monthlyPendingFees: monthlyTotals?.pendingFees ?? 0,
      },
    });
  });

  // ============================================================================
  // ⚙️ 平台全域設定（Phase A-1.4）
  // 儲存於 platform_plans[code='__platform_config__'] 的 limits 欄位（hack 但可用）
  // 或用獨立表；這裡用 JSON 儲存於特殊 plan 記錄
  // ============================================================================
  const PLATFORM_CONFIG_CODE = "__platform_config__";

  app.get("/api/platform/settings", requirePlatformAdmin, async (_req, res) => {
    const existing = await db.query.platformPlans.findFirst({
      where: eq(platformPlans.code, PLATFORM_CONFIG_CODE),
    });
    const config = existing?.limits ? (existing.limits as Record<string, unknown>) : {};
    res.json({
      platformName: config.platformName ?? "CHITO",
      supportEmail: config.supportEmail ?? "",
      defaultPlanCode: config.defaultPlanCode ?? "free",
      maintenanceMode: config.maintenanceMode ?? false,
      applicationsOpen: config.applicationsOpen ?? true,
      customMessage: config.customMessage ?? "",
    });
  });

  app.patch("/api/platform/settings", requirePlatformAdmin, async (req, res) => {
    const parsed = z
      .object({
        platformName: z.string().min(1).max(100).optional(),
        supportEmail: z.string().email().or(z.literal("")).optional(),
        defaultPlanCode: z.string().optional(),
        maintenanceMode: z.boolean().optional(),
        applicationsOpen: z.boolean().optional(),
        customMessage: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "格式錯誤", details: parsed.error.errors });
    }

    const existing = await db.query.platformPlans.findFirst({
      where: eq(platformPlans.code, PLATFORM_CONFIG_CODE),
    });

    const merged = {
      ...(existing?.limits as Record<string, unknown> ?? {}),
      ...parsed.data,
    };

    if (existing) {
      const [updated] = await db
        .update(platformPlans)
        .set({ limits: merged })
        .where(eq(platformPlans.id, existing.id))
        .returning();
      return res.json({ success: true, settings: updated.limits });
    }

    // 首次建立 — 用特殊 code 當設定儲存
    const [created] = await db
      .insert(platformPlans)
      .values({
        code: PLATFORM_CONFIG_CODE,
        name: "【系統設定 - 勿刪】",
        description: "內部用於儲存平台全域設定，非實際方案",
        monthlyPrice: 0,
        status: "archived",
        sortOrder: 9999,
        limits: merged,
      })
      .returning();
    res.json({ success: true, settings: created.limits });
  });

  // ============================================================================
  // 🆕 2026-04-30 — 跨場域管理員管理（platform-level admin oversight）
  // ============================================================================

  /**
   * GET /api/platform/admins
   * 列出**所有場域**的所有管理員帳號
   * 用於 super_admin 在平台首頁集中管理所有場域 admin（不必逐場域切換）
   *
   * Query：
   *   ?fieldId=xxx — 僅列該場域
   *   ?status=active|inactive — 僅列特定狀態
   */
  app.get("/api/platform/admins", requirePlatformAdmin, async (req, res) => {
    try {
      const fieldFilter = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const accounts = await db.query.adminAccounts.findMany({
        where: fieldFilter ? eq(adminAccounts.fieldId, fieldFilter) : undefined,
        with: {
          role: true,
          field: true,
        },
        orderBy: [desc(adminAccounts.createdAt)],
      });

      // 移除 password hash（永遠不該回傳）
      const safeAccounts = accounts.map((acc) => ({
        ...acc,
        passwordHash: undefined,
      }));

      res.json({ accounts: safeAccounts, total: safeAccounts.length });
    } catch (error) {
      console.error("[platform/admins] failed:", error);
      res.status(500).json({ message: "取得管理員列表失敗" });
    }
  });

  /**
   * PATCH /api/platform/admins/:id
   * 更新任一場域 admin 帳號（status / roleId / displayName / email）
   * Platform admin 可以跨場域操作，不受 fieldId 限制
   */
  const platformAccountPatchSchema = z.object({
    status: z.enum(["active", "inactive", "locked"]).optional(),
    roleId: z.string().uuid().nullable().optional(),
    displayName: z.string().max(100).optional(),
    email: z.string().email().nullable().optional(),
  });

  app.patch("/api/platform/admins/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = platformAccountPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "資料格式錯誤",
          errors: parsed.error.errors,
        });
      }

      // 取舊資料給 audit 用
      const existing = await db.query.adminAccounts.findFirst({
        where: eq(adminAccounts.id, req.params.id),
      });

      const [updated] = await db
        .update(adminAccounts)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(adminAccounts.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "帳號不存在" });
      }

      // 🆕 稽核日誌
      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:admin_account_update",
        targetType: "admin_account",
        targetId: updated.id,
        fieldId: updated.fieldId ?? undefined,
        metadata: {
          changes: parsed.data,
          oldStatus: existing?.status,
          oldRoleId: existing?.roleId,
          targetUsername: updated.username,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ ...updated, passwordHash: undefined });
    } catch (error) {
      console.error("[platform/admins] PATCH failed:", error);
      res.status(500).json({ message: "更新管理員失敗" });
    }
  });

  // ============================================================================
  // 🆕 跨場域角色與權限管理
  // ============================================================================

  /**
   * GET /api/platform/roles
   * 列出**所有場域**的角色（含每個角色的 permissions）
   * 可用 ?fieldId=xxx 過濾
   */
  app.get("/api/platform/roles", requirePlatformAdmin, async (req, res) => {
    try {
      const fieldFilter = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const allRoles = await db.query.roles.findMany({
        where: fieldFilter ? eq(roles.fieldId, fieldFilter) : undefined,
        with: { field: true },
        orderBy: [desc(roles.createdAt)],
      });

      // 取每個 role 的 permissions（一次性 query 避免 N+1）
      const roleIds = allRoles.map((r) => r.id);
      const allRolePerms = roleIds.length
        ? await db
            .select({
              roleId: rolePermissions.roleId,
              permissionKey: permissions.key,
              allow: rolePermissions.allow,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(sql`${rolePermissions.roleId} = ANY(${roleIds})`)
        : [];

      // 把 permissions 塞回每個 role
      const rolesWithPerms = allRoles.map((r) => ({
        ...r,
        permissions: allRolePerms
          .filter((p) => p.roleId === r.id && p.allow)
          .map((p) => p.permissionKey),
      }));

      res.json({ roles: rolesWithPerms, total: rolesWithPerms.length });
    } catch (error) {
      console.error("[platform/roles] failed:", error);
      res.status(500).json({ message: "取得角色列表失敗" });
    }
  });

  /**
   * GET /api/platform/permissions
   * 列出系統所有 permission keys（給 role 編輯器選用）
   */
  app.get("/api/platform/permissions", requirePlatformAdmin, async (_req, res) => {
    try {
      const allPerms = await db.query.permissions.findMany({
        orderBy: [permissions.category, permissions.key],
      });
      res.json({ permissions: allPerms, total: allPerms.length });
    } catch (error) {
      console.error("[platform/permissions] failed:", error);
      res.status(500).json({ message: "取得權限列表失敗" });
    }
  });

  /**
   * PATCH /api/platform/roles/:id
   * 更新角色（platform 層，可編輯任何場域的角色）
   * Body: { name?, description?, permissionIds?: string[] }
   *
   * permissionIds 傳入時：刪除原 rolePermissions → 全部重建
   * 不傳則只更新 name/description
   */
  const platformRolePatchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    permissionIds: z.array(z.string().uuid()).optional(),
  });

  app.patch("/api/platform/roles/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = platformRolePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const existing = await db.query.roles.findFirst({
        where: eq(roles.id, req.params.id),
      });
      if (!existing) return res.status(404).json({ message: "角色不存在" });

      // 防護：super_admin systemRole 不可被改名/刪權限（避免鎖死自己）
      if (existing.systemRole === "super_admin") {
        return res.status(403).json({ message: "super_admin 系統角色不可修改" });
      }

      // 更新基本欄位
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;

      const [updated] = await db
        .update(roles)
        .set(updates)
        .where(eq(roles.id, req.params.id))
        .returning();

      // 更新權限
      let oldPermissionCount = 0;
      let newPermissionCount = 0;
      if (parsed.data.permissionIds !== undefined) {
        // 取舊 permissions（給 audit 用）
        const oldPerms = await db.query.rolePermissions.findMany({
          where: eq(rolePermissions.roleId, updated.id),
        });
        oldPermissionCount = oldPerms.length;

        // 刪除舊全部 → 重建
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, updated.id));
        if (parsed.data.permissionIds.length > 0) {
          await db.insert(rolePermissions).values(
            parsed.data.permissionIds.map((permId) => ({
              roleId: updated.id,
              permissionId: permId,
              allow: true,
            })),
          );
          newPermissionCount = parsed.data.permissionIds.length;
        }
      }

      // 🆕 audit log
      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:role_update",
        targetType: "role",
        targetId: updated.id,
        fieldId: updated.fieldId ?? undefined,
        metadata: {
          changes: parsed.data,
          oldPermissionCount,
          newPermissionCount,
          targetRoleName: updated.name,
          targetSystemRole: updated.systemRole,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (error) {
      console.error("[platform/roles] PATCH failed:", error);
      res.status(500).json({ message: "更新角色失敗" });
    }
  });

  // ============================================================================
  // 🆕 P0-1（2026-04-30）— 平台稽核日誌
  //   重用既有 audit_logs 表，提供跨場域查詢介面
  //   action 前綴 platform: 為平台層操作（vs admin: 為場域層）
  // ============================================================================

  // ============================================================================
  // 🆕 IP 白名單管理（2026-04-30）
  //   注意：只給 platform admin 用，不影響場域 admin / 玩家
  //   驗證在 platformAuth.ts 中完成（若白名單啟用且 IP 不在內 → 拒絕）
  // ============================================================================

  app.get("/api/platform/ip-whitelist", requirePlatformAdmin, async (_req, res) => {
    try {
      const items = await db.query.platformIpWhitelist.findMany({
        orderBy: [desc(platformIpWhitelist.createdAt)],
      });
      res.json({ items, total: items.length });
    } catch (error) {
      console.error("[platform/ip-whitelist] failed:", error);
      res.status(500).json({ message: "取得白名單失敗" });
    }
  });

  const ipWhitelistSchema = z.object({
    ipOrCidr: z.string()
      .min(7)
      .max(50)
      .regex(
        /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/,
        "格式必須為 IPv4 或 CIDR（例：192.168.1.1 或 10.0.0.0/24）"
      ),
    label: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional().default(true),
  });

  app.post("/api/platform/ip-whitelist", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = ipWhitelistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const [created] = await db
        .insert(platformIpWhitelist)
        .values({
          ...parsed.data,
          createdByAdminId: req.platform?.adminAccountId ?? null,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ip_whitelist_add",
        targetType: "platform_ip_whitelist",
        targetId: created.id,
        metadata: { ipOrCidr: created.ipOrCidr, label: created.label },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("[platform/ip-whitelist] POST failed:", error);
      res.status(500).json({ message: "新增白名單失敗" });
    }
  });

  app.patch("/api/platform/ip-whitelist/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = ipWhitelistSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const [updated] = await db
        .update(platformIpWhitelist)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(platformIpWhitelist.id, req.params.id))
        .returning();

      if (!updated) return res.status(404).json({ message: "白名單項目不存在" });

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ip_whitelist_update",
        targetType: "platform_ip_whitelist",
        targetId: updated.id,
        metadata: { changes: parsed.data },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (error) {
      console.error("[platform/ip-whitelist] PATCH failed:", error);
      res.status(500).json({ message: "更新白名單失敗" });
    }
  });

  app.delete("/api/platform/ip-whitelist/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const existing = await db.query.platformIpWhitelist.findFirst({
        where: eq(platformIpWhitelist.id, req.params.id),
      });
      if (!existing) return res.status(404).json({ message: "白名單項目不存在" });

      await db.delete(platformIpWhitelist).where(eq(platformIpWhitelist.id, req.params.id));

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:ip_whitelist_delete",
        targetType: "platform_ip_whitelist",
        targetId: existing.id,
        metadata: { ipOrCidr: existing.ipOrCidr, label: existing.label },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[platform/ip-whitelist] DELETE failed:", error);
      res.status(500).json({ message: "刪除白名單失敗" });
    }
  });

  // ============================================================================
  // 🆕 API 金鑰管理（2026-04-30）— 跨場域聚合 AI key 狀態
  // ============================================================================

  /**
   * GET /api/platform/api-keys
   * 列出所有場域的 AI API key 設定狀態（不回傳 key 內容！只回傳 mask 與用量）
   */
  app.get("/api/platform/api-keys", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allFields = await db.query.fields.findMany({
        columns: { id: true, name: true, code: true, settings: true },
      });

      // 一次抓 30 天內各場域 AI 用量（join ai_usage_logs）
      const usageRows = await db.execute<{
        field_id: string;
        provider: string;
        usage_30d: number;
        success_rate: number;
        last_used: string | null;
      }>(sql`
        SELECT
          field_id,
          provider,
          COUNT(*)::int AS usage_30d,
          (COUNT(*) FILTER (WHERE success = true)::float / NULLIF(COUNT(*), 0)) AS success_rate,
          MAX(created_at)::text AS last_used
        FROM ai_usage_logs
        WHERE created_at >= ${past30d.toISOString()}
          AND field_id IS NOT NULL
        GROUP BY field_id, provider
      `);

      // 用 Map 聚合：fieldId → { provider → stats }
      const usageMap = new Map<string, Map<string, typeof usageRows.rows[number]>>();
      for (const r of usageRows.rows) {
        if (!usageMap.has(r.field_id)) usageMap.set(r.field_id, new Map());
        usageMap.get(r.field_id)!.set(r.provider, r);
      }

      const items = allFields.map((f) => {
        const settings = (f.settings as Record<string, unknown>) ?? {};
        const geminiKey = settings.geminiApiKey as string | undefined;
        const hasGeminiKey = !!geminiKey && geminiKey.length > 0;
        // mask: 顯示前 4 + 後 4，中間 ****
        const maskedKey = hasGeminiKey && geminiKey.length > 12
          ? `${geminiKey.slice(0, 4)}****${geminiKey.slice(-4)}`
          : (hasGeminiKey ? "****" : null);

        const fieldUsage = usageMap.get(f.id);
        const providers = fieldUsage
          ? Array.from(fieldUsage.entries()).map(([provider, u]) => ({
              provider,
              usage30d: u.usage_30d,
              successRate: u.success_rate,
              lastUsed: u.last_used,
            }))
          : [];

        return {
          fieldId: f.id,
          fieldName: f.name,
          fieldCode: f.code,
          gemini: {
            configured: hasGeminiKey,
            maskedKey,
          },
          providers,
        };
      });

      res.json({ items, total: items.length });
    } catch (error) {
      console.error("[platform/api-keys] failed:", error);
      res.status(500).json({ message: "取得 API 金鑰狀態失敗" });
    }
  });

  // ============================================================================
  // 🆕 錯誤記錄管理（2026-04-30）
  // ============================================================================

  /**
   * GET /api/platform/errors
   * Query: ?level=error|warning|info  ?resolved=true|false  ?fieldId=x  ?limit=100
   */
  app.get("/api/platform/errors", requirePlatformAdmin, async (req, res) => {
    try {
      const level = typeof req.query.level === "string" ? req.query.level : null;
      const resolvedFilter = typeof req.query.resolved === "string" ? req.query.resolved : null;
      const fieldFilter = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);

      const conds = [];
      if (level) conds.push(eq(errorLogs.level, level));
      if (resolvedFilter === "true") conds.push(sql`${errorLogs.resolvedAt} IS NOT NULL`);
      if (resolvedFilter === "false") conds.push(sql`${errorLogs.resolvedAt} IS NULL`);
      if (fieldFilter) conds.push(eq(errorLogs.fieldId, fieldFilter));

      const items = await db.query.errorLogs.findMany({
        where: conds.length ? and(...conds) : undefined,
        orderBy: [desc(errorLogs.lastSeenAt)],
        limit,
      });

      res.json({ items, total: items.length });
    } catch (error) {
      console.error("[platform/errors] failed:", error);
      res.status(500).json({ message: "取得錯誤紀錄失敗" });
    }
  });

  /**
   * GET /api/platform/errors/stats
   */
  app.get("/api/platform/errors/stats", requirePlatformAdmin, async (_req, res) => {
    try {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await db.execute<{
        total: number;
        unresolved: number;
        last_24h: number;
        last_7d: number;
        unique_fingerprints: number;
        total_occurrences: number;
      }>(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS unresolved,
          COUNT(*) FILTER (WHERE last_seen_at >= ${past24h.toISOString()})::int AS last_24h,
          COUNT(*) FILTER (WHERE last_seen_at >= ${past7d.toISOString()})::int AS last_7d,
          COUNT(DISTINCT fingerprint)::int AS unique_fingerprints,
          COALESCE(SUM(occurrence_count), 0)::int AS total_occurrences
        FROM error_logs
      `);
      res.json(result.rows[0] ?? {});
    } catch (error) {
      console.error("[platform/errors/stats] failed:", error);
      res.status(500).json({ message: "取得錯誤統計失敗" });
    }
  });

  /**
   * PATCH /api/platform/errors/:id — 標記已解決
   */
  const resolveErrorSchema = z.object({
    note: z.string().max(1000).optional(),
  });

  app.patch("/api/platform/errors/:id/resolve", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = resolveErrorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤" });
      }
      const [updated] = await db
        .update(errorLogs)
        .set({
          resolvedAt: new Date(),
          resolvedByAdminId: req.platform?.adminAccountId ?? null,
          resolvedNote: parsed.data.note,
        })
        .where(eq(errorLogs.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "錯誤紀錄不存在" });

      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:error_resolved",
        targetType: "error_log",
        targetId: updated.id,
        metadata: { note: parsed.data.note, fingerprint: updated.fingerprint },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(updated);
    } catch (error) {
      console.error("[platform/errors/resolve] failed:", error);
      res.status(500).json({ message: "標記已解決失敗" });
    }
  });

  // ============================================================================
  // 🆕 系統健康監控（2026-04-30）
  // ============================================================================

  /**
   * GET /api/platform/health/check
   * 即時檢查各模組狀態：
   *   - DB（PostgreSQL）
   *   - Cloudinary（環境變數有沒有）
   *   - Firebase（環境變數有沒有）
   *   - 最近 error_logs 數量
   *   - process uptime / memory
   */
  app.get("/api/platform/health/check", requirePlatformAdmin, async (_req, res) => {
    const checks: Array<{
      name: string;
      status: "healthy" | "degraded" | "down";
      latencyMs?: number;
      detail?: string;
    }> = [];

    // DB ping
    const dbStart = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      checks.push({
        name: "PostgreSQL",
        status: "healthy",
        latencyMs: Date.now() - dbStart,
      });
    } catch (e) {
      checks.push({
        name: "PostgreSQL",
        status: "down",
        latencyMs: Date.now() - dbStart,
        detail: e instanceof Error ? e.message : "unknown error",
      });
    }

    // Cloudinary 配置檢查
    const cloudConfigured =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;
    checks.push({
      name: "Cloudinary",
      status: cloudConfigured ? "healthy" : "degraded",
      detail: cloudConfigured ? "配置完整" : "環境變數缺失",
    });

    // Firebase 配置檢查
    const firebaseConfigured =
      !!process.env.FIREBASE_PROJECT_ID || !!process.env.VITE_FIREBASE_PROJECT_ID;
    checks.push({
      name: "Firebase",
      status: firebaseConfigured ? "healthy" : "degraded",
      detail: firebaseConfigured ? "配置完整" : "未設定 Firebase 環境變數",
    });

    // Resend Email
    const resendConfigured = !!process.env.RESEND_API_KEY;
    checks.push({
      name: "Resend Email",
      status: resendConfigured ? "healthy" : "degraded",
      detail: resendConfigured ? "已配置" : "未設定 RESEND_API_KEY",
    });

    // 最近錯誤統計
    try {
      const past1h = new Date(Date.now() - 60 * 60 * 1000);
      const errCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(errorLogs)
        .where(sql`${errorLogs.lastSeenAt} >= ${past1h.toISOString()}`)
        .then((r) => Number(r[0]?.count ?? 0));
      checks.push({
        name: "近 1 小時錯誤",
        status: errCount === 0 ? "healthy" : errCount < 10 ? "degraded" : "down",
        detail: `${errCount} 筆`,
      });
    } catch {
      checks.push({ name: "近 1 小時錯誤", status: "down", detail: "查詢失敗" });
    }

    // Process 資訊
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    res.json({
      timestamp: new Date().toISOString(),
      checks,
      process: {
        uptimeSeconds,
        uptimeText: formatUptime(uptimeSeconds),
        memoryMB: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        nodeVersion: process.version,
      },
      summary: {
        healthy: checks.filter((c) => c.status === "healthy").length,
        degraded: checks.filter((c) => c.status === "degraded").length,
        down: checks.filter((c) => c.status === "down").length,
      },
    });
  });

  // ============================================================================
  // 🆕 B 安全機制（2026-04-30）— 登入監控 + 鎖定帳號管理
  // ============================================================================

  /**
   * GET /api/platform/security/overview
   * 安全儀表板總覽：
   *   - 過去 24h 登入失敗次數
   *   - 過去 7 天登入失敗次數
   *   - 鎖定帳號數
   *   - 風險 IP 數量（24h 內失敗超過 10 次的 IP）
   */
  app.get("/api/platform/security/overview", requirePlatformAdmin, async (_req, res) => {
    try {
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [stats] = await Promise.all([
        db.execute<{
          failures_24h: number;
          failures_7d: number;
          locked_accounts: number;
          risky_ips: number;
          unique_failed_users_24h: number;
        }>(sql`
          SELECT
            (SELECT COUNT(*)::int FROM audit_logs
              WHERE action LIKE 'auth:login_%' AND created_at >= ${past24h.toISOString()}
            ) AS failures_24h,
            (SELECT COUNT(*)::int FROM audit_logs
              WHERE action LIKE 'auth:login_%' AND created_at >= ${past7d.toISOString()}
            ) AS failures_7d,
            (SELECT COUNT(*)::int FROM admin_accounts WHERE status = 'locked') AS locked_accounts,
            (SELECT COUNT(*)::int FROM (
              SELECT ip_address, COUNT(*) AS cnt
              FROM audit_logs
              WHERE action LIKE 'auth:login_%'
                AND created_at >= ${past24h.toISOString()}
                AND ip_address IS NOT NULL
              GROUP BY ip_address
              HAVING COUNT(*) >= 10
            ) AS risky) AS risky_ips,
            (SELECT COUNT(DISTINCT actor_admin_id)::int FROM audit_logs
              WHERE action LIKE 'auth:login_%'
                AND created_at >= ${past24h.toISOString()}
                AND actor_admin_id IS NOT NULL
            ) AS unique_failed_users_24h
        `).then((r) => r.rows[0]),
      ]);

      res.json(stats ?? {});
    } catch (error) {
      console.error("[platform/security/overview] failed:", error);
      res.status(500).json({ message: "取得安全總覽失敗" });
    }
  });

  /**
   * GET /api/platform/security/login-failures
   * 最近登入失敗紀錄（從 audit_logs.action = auth:login_*）
   * Query: ?hours=24 (預設) ?ip=x ?username=x
   */
  app.get("/api/platform/security/login-failures", requirePlatformAdmin, async (req, res) => {
    try {
      const hours = Math.min(parseInt(String(req.query.hours ?? "24"), 10) || 24, 720);
      const ipFilter = typeof req.query.ip === "string" ? req.query.ip : null;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const conds = [
        sql`${auditLogs.action} LIKE 'auth:login_%'`,
        gte(auditLogs.createdAt, since),
      ];
      if (ipFilter) conds.push(eq(auditLogs.ipAddress, ipFilter));

      const logs = await db.query.auditLogs.findMany({
        where: and(...conds),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 200,
      });

      // join admin accounts
      const adminIds = Array.from(
        new Set(logs.map((l) => l.actorAdminId).filter(Boolean) as string[]),
      );
      const adminList = adminIds.length
        ? await db.query.adminAccounts.findMany({
            where: inArray(adminAccountsTable.id, adminIds),
            columns: {
              id: true,
              username: true,
              displayName: true,
              status: true,
              fieldId: true,
              failedLoginAttempts: true,
            },
          })
        : [];
      const adminMap = new Map(adminList.map((a) => [a.id, a]));

      const enriched = logs.map((l) => ({
        ...l,
        admin: l.actorAdminId ? adminMap.get(l.actorAdminId) ?? null : null,
      }));

      res.json({ items: enriched, total: enriched.length });
    } catch (error) {
      console.error("[platform/security/login-failures] failed:", error);
      res.status(500).json({ message: "取得登入失敗紀錄失敗" });
    }
  });

  /**
   * GET /api/platform/security/risky-ips
   * 24h 內登入失敗超過閾值的 IP（聚合）
   * Query: ?threshold=10 (預設)
   */
  app.get("/api/platform/security/risky-ips", requirePlatformAdmin, async (req, res) => {
    try {
      const threshold = Math.max(parseInt(String(req.query.threshold ?? "10"), 10) || 10, 3);
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rows = await db.execute<{
        ip_address: string;
        attempts: number;
        unique_users: number;
        last_attempt: string;
      }>(sql`
        SELECT
          ip_address,
          COUNT(*)::int AS attempts,
          COUNT(DISTINCT actor_admin_id)::int AS unique_users,
          MAX(created_at)::text AS last_attempt
        FROM audit_logs
        WHERE action LIKE 'auth:login_%'
          AND created_at >= ${past24h.toISOString()}
          AND ip_address IS NOT NULL
        GROUP BY ip_address
        HAVING COUNT(*) >= ${threshold}
        ORDER BY attempts DESC
        LIMIT 50
      `);

      res.json({ items: rows.rows, threshold });
    } catch (error) {
      console.error("[platform/security/risky-ips] failed:", error);
      res.status(500).json({ message: "取得風險 IP 失敗" });
    }
  });

  /**
   * GET /api/platform/security/locked-accounts
   * 所有目前鎖定的帳號
   */
  app.get("/api/platform/security/locked-accounts", requirePlatformAdmin, async (_req, res) => {
    try {
      const accounts = await db.query.adminAccounts.findMany({
        where: eq(adminAccountsTable.status, "locked"),
        with: {
          field: true,
          role: true,
        },
        orderBy: [desc(adminAccountsTable.updatedAt)],
      });

      const safe = accounts.map((a) => ({
        ...a,
        passwordHash: undefined,
      }));

      res.json({ items: safe, total: safe.length });
    } catch (error) {
      console.error("[platform/security/locked-accounts] failed:", error);
      res.status(500).json({ message: "取得鎖定帳號失敗" });
    }
  });

  /**
   * POST /api/platform/security/unlock-account
   * 手動解鎖帳號（reset failedLoginAttempts + status back to active）
   */
  const unlockSchema = z.object({
    accountId: z.string().uuid(),
    reason: z.string().max(500).optional(),
  });

  app.post("/api/platform/security/unlock-account", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = unlockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤" });
      }

      const existing = await db.query.adminAccounts.findFirst({
        where: eq(adminAccountsTable.id, parsed.data.accountId),
      });
      if (!existing) return res.status(404).json({ message: "帳號不存在" });

      const [updated] = await db
        .update(adminAccountsTable)
        .set({
          status: "active",
          failedLoginAttempts: 0,
          updatedAt: new Date(),
        })
        .where(eq(adminAccountsTable.id, parsed.data.accountId))
        .returning();

      // 🆕 audit log
      await logAuditAction({
        actorAdminId: req.platform?.adminAccountId ?? undefined,
        action: "platform:account_unlock",
        targetType: "admin_account",
        targetId: updated.id,
        fieldId: updated.fieldId ?? undefined,
        metadata: {
          targetUsername: updated.username,
          previousAttempts: existing.failedLoginAttempts,
          reason: parsed.data.reason,
          actorRole: req.platform?.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ ...updated, passwordHash: undefined });
    } catch (error) {
      console.error("[platform/security/unlock-account] failed:", error);
      res.status(500).json({ message: "解鎖帳號失敗" });
    }
  });

  // ============================================================================
  // 🆕 數據資訊統計（2026-04-30）— 平台整體洞察
  //   涵蓋：場域 KPI 排名 / 遊戲熱度 / 玩家活躍 / 元件使用
  // ============================================================================

  /**
   * GET /api/platform/insights/overview
   * 平台整體 KPI：總場域 / 總玩家 / 總遊戲 / 總場次 / 今日活躍 / 累計營收
   */
  app.get("/api/platform/insights/overview", requirePlatformAdmin, async (_req, res) => {
    try {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await db.execute<{
        total_fields: number;
        total_users: number;
        total_games: number;
        total_sessions: number;
        sessions_today: number;
        sessions_24h: number;
        sessions_7d: number;
        sessions_30d: number;
        completed_sessions: number;
        total_revenue: number;
      }>(sql`
        SELECT
          (SELECT COUNT(*)::int FROM fields) AS total_fields,
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM games) AS total_games,
          (SELECT COUNT(*)::int FROM game_sessions) AS total_sessions,
          (SELECT COUNT(*)::int FROM game_sessions WHERE started_at >= ${todayStart.toISOString()}) AS sessions_today,
          (SELECT COUNT(*)::int FROM game_sessions WHERE started_at >= ${past24h.toISOString()}) AS sessions_24h,
          (SELECT COUNT(*)::int FROM game_sessions WHERE started_at >= ${past7d.toISOString()}) AS sessions_7d,
          (SELECT COUNT(*)::int FROM game_sessions WHERE started_at >= ${past30d.toISOString()}) AS sessions_30d,
          (SELECT COUNT(*)::int FROM game_sessions WHERE status = 'completed') AS completed_sessions,
          (SELECT COALESCE(SUM(amount), 0)::int FROM platform_transactions WHERE status = 'paid') AS total_revenue
      `);

      const row = result.rows[0] ?? null;
      if (!row) return res.json({});
      const completionRate = row.total_sessions > 0
        ? (row.completed_sessions / row.total_sessions) * 100
        : 0;

      res.json({
        ...row,
        completionRate: parseFloat(completionRate.toFixed(2)),
      });
    } catch (error) {
      console.error("[platform/insights/overview] failed:", error);
      res.status(500).json({ message: "取得平台總覽失敗" });
    }
  });

  /**
   * GET /api/platform/insights/engagement
   * DAU/WAU/MAU 估算（從 game_sessions 找 distinct users）
   */
  app.get("/api/platform/insights/engagement", requirePlatformAdmin, async (_req, res) => {
    try {
      const past1d = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const past7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 用 player_progress.userId（每個 session 可能多人）
      const result = await db.execute<{
        dau: number;
        wau: number;
        mau: number;
      }>(sql`
        SELECT
          (SELECT COUNT(DISTINCT pp.user_id)::int
            FROM player_progress pp
            INNER JOIN game_sessions gs ON pp.session_id = gs.id
            WHERE gs.started_at >= ${past1d.toISOString()} AND pp.user_id IS NOT NULL) AS dau,
          (SELECT COUNT(DISTINCT pp.user_id)::int
            FROM player_progress pp
            INNER JOIN game_sessions gs ON pp.session_id = gs.id
            WHERE gs.started_at >= ${past7d.toISOString()} AND pp.user_id IS NOT NULL) AS wau,
          (SELECT COUNT(DISTINCT pp.user_id)::int
            FROM player_progress pp
            INNER JOIN game_sessions gs ON pp.session_id = gs.id
            WHERE gs.started_at >= ${past30d.toISOString()} AND pp.user_id IS NOT NULL) AS mau
      `);

      const row = result.rows[0] ?? { dau: 0, wau: 0, mau: 0 };
      const stickiness = row.mau > 0 ? (row.dau / row.mau) * 100 : 0;
      res.json({
        ...row,
        stickiness: parseFloat(stickiness.toFixed(2)),
      });
    } catch (error) {
      console.error("[platform/insights/engagement] failed:", error);
      res.status(500).json({ message: "取得活躍度失敗" });
    }
  });

  /**
   * GET /api/platform/insights/field-rankings
   * 場域 KPI 排行（依玩家數 / 遊戲數 / 場次 / 收益）
   * Query: ?metric=players|games|sessions|revenue (default: sessions)
   */
  app.get("/api/platform/insights/field-rankings", requirePlatformAdmin, async (req, res) => {
    try {
      const metric = typeof req.query.metric === "string" ? req.query.metric : "sessions";
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const rows = await db.execute<{
        field_id: string;
        field_name: string;
        field_code: string;
        total_games: number;
        total_sessions: number;
        active_users: number;
        revenue: number;
      }>(sql`
        SELECT
          f.id AS field_id,
          f.name AS field_name,
          f.code AS field_code,
          (SELECT COUNT(*)::int FROM games g WHERE g.field_id = f.id) AS total_games,
          (SELECT COUNT(*)::int FROM game_sessions gs
            INNER JOIN games g ON gs.game_id = g.id
            WHERE g.field_id = f.id AND gs.started_at >= ${past30d.toISOString()}
          ) AS total_sessions,
          (SELECT COUNT(DISTINCT pp.user_id)::int
            FROM player_progress pp
            INNER JOIN game_sessions gs ON pp.session_id = gs.id
            INNER JOIN games g ON gs.game_id = g.id
            WHERE g.field_id = f.id
              AND gs.started_at >= ${past30d.toISOString()}
              AND pp.user_id IS NOT NULL
          ) AS active_users,
          (SELECT COALESCE(SUM(amount), 0)::int
            FROM platform_transactions
            WHERE field_id = f.id AND status = 'paid'
              AND created_at >= ${past30d.toISOString()}
          ) AS revenue
        FROM fields f
        ORDER BY ${sql.raw(
          metric === "players" ? "active_users" :
          metric === "games" ? "total_games" :
          metric === "revenue" ? "revenue" :
          "total_sessions"
        )} DESC
        LIMIT 20
      `);

      res.json({ items: rows.rows, metric });
    } catch (error) {
      console.error("[platform/insights/field-rankings] failed:", error);
      res.status(500).json({ message: "取得場域排行失敗" });
    }
  });

  /**
   * GET /api/platform/insights/game-rankings
   * 遊戲熱度排行 — Top 20（過去 30 天）
   */
  app.get("/api/platform/insights/game-rankings", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const rows = await db.execute<{
        game_id: string;
        game_title: string;
        field_id: string | null;
        field_code: string | null;
        total_sessions: number;
        completed_sessions: number;
        unique_players: number;
        avg_score: number;
      }>(sql`
        SELECT
          g.id AS game_id,
          g.title AS game_title,
          g.field_id AS field_id,
          f.code AS field_code,
          COUNT(gs.id)::int AS total_sessions,
          COUNT(*) FILTER (WHERE gs.status = 'completed')::int AS completed_sessions,
          COUNT(DISTINCT pp.user_id)::int AS unique_players,
          COALESCE(AVG(gs.score) FILTER (WHERE gs.status = 'completed'), 0)::int AS avg_score
        FROM games g
        LEFT JOIN game_sessions gs ON gs.game_id = g.id AND gs.started_at >= ${past30d.toISOString()}
        LEFT JOIN player_progress pp ON pp.session_id = gs.id
        LEFT JOIN fields f ON f.id = g.field_id
        GROUP BY g.id, g.title, g.field_id, f.code
        HAVING COUNT(gs.id) > 0
        ORDER BY total_sessions DESC
        LIMIT 20
      `);

      const enriched = rows.rows.map((r) => ({
        ...r,
        completionRate: r.total_sessions > 0
          ? parseFloat(((r.completed_sessions / r.total_sessions) * 100).toFixed(1))
          : 0,
      }));

      res.json({ items: enriched });
    } catch (error) {
      console.error("[platform/insights/game-rankings] failed:", error);
      res.status(500).json({ message: "取得遊戲排行失敗" });
    }
  });

  /**
   * GET /api/platform/insights/component-usage
   * pageType 元件使用次數（從 pages + player_progress.currentPageId 推估）
   */
  app.get("/api/platform/insights/component-usage", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.execute<{
        page_type: string;
        usage_count: number;
        unique_pages: number;
      }>(sql`
        SELECT
          p.page_type AS page_type,
          COUNT(DISTINCT pp.id)::int AS usage_count,
          COUNT(DISTINCT p.id)::int AS unique_pages
        FROM pages p
        LEFT JOIN player_progress pp ON pp.current_page_id = p.id
        LEFT JOIN game_sessions gs ON pp.session_id = gs.id
        WHERE gs.started_at >= ${past30d.toISOString()}
        GROUP BY p.page_type
        ORDER BY usage_count DESC
      `);

      res.json({ items: rows.rows });
    } catch (error) {
      console.error("[platform/insights/component-usage] failed:", error);
      res.status(500).json({ message: "取得元件使用統計失敗" });
    }
  });

  /**
   * GET /api/platform/insights/daily-trend
   * 過去 30 天每日趨勢（場次數 / DAU）
   */
  app.get("/api/platform/insights/daily-trend", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.execute<{
        day: string;
        sessions: number;
        dau: number;
      }>(sql`
        SELECT
          DATE_TRUNC('day', gs.started_at)::date::text AS day,
          COUNT(*)::int AS sessions,
          COUNT(DISTINCT pp.user_id)::int AS dau
        FROM game_sessions gs
        LEFT JOIN player_progress pp ON pp.session_id = gs.id
        WHERE gs.started_at >= ${past30d.toISOString()}
        GROUP BY DATE_TRUNC('day', gs.started_at)
        ORDER BY day
      `);

      res.json({ items: rows.rows });
    } catch (error) {
      console.error("[platform/insights/daily-trend] failed:", error);
      res.status(500).json({ message: "取得趨勢失敗" });
    }
  });

  // ============================================================================
  // 🆕 P1-1（2026-04-30）— 用量監控儀表板
  // ============================================================================

  /**
   * GET /api/platform/usage/overview
   * 平台總體用量總覽：
   *   - 過去 24 小時 / 7 天 / 30 天的 AI 呼叫總量
   *   - 整體成功率
   *   - 平均延遲
   */
  app.get("/api/platform/usage/overview", requirePlatformAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [stats24h, stats7d, stats30d] = await Promise.all([
        db.execute<{ total: number; success: number; fail: number; avg_latency: number }>(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = true)::int AS success,
            COUNT(*) FILTER (WHERE success = false)::int AS fail,
            COALESCE(AVG(latency_ms), 0)::int AS avg_latency
          FROM ai_usage_logs
          WHERE created_at >= ${past24h.toISOString()}
        `).then((r) => r.rows[0] ?? { total: 0, success: 0, fail: 0, avg_latency: 0 }),
        db.execute<{ total: number; success: number; fail: number }>(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = true)::int AS success,
            COUNT(*) FILTER (WHERE success = false)::int AS fail
          FROM ai_usage_logs
          WHERE created_at >= ${past7d.toISOString()}
        `).then((r) => r.rows[0] ?? { total: 0, success: 0, fail: 0 }),
        db.execute<{ total: number; success: number; fail: number }>(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE success = true)::int AS success,
            COUNT(*) FILTER (WHERE success = false)::int AS fail
          FROM ai_usage_logs
          WHERE created_at >= ${past30d.toISOString()}
        `).then((r) => r.rows[0] ?? { total: 0, success: 0, fail: 0 }),
      ]);

      res.json({
        last24h: stats24h,
        last7d: stats7d,
        last30d: stats30d,
      });
    } catch (error) {
      console.error("[platform/usage/overview] failed:", error);
      res.status(500).json({ message: "取得用量總覽失敗" });
    }
  });

  /**
   * GET /api/platform/usage/by-provider
   * 過去 30 天各 AI provider 用量分布
   */
  app.get("/api/platform/usage/by-provider", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.execute<{
        provider: string;
        total: number;
        success: number;
        fail: number;
        avg_latency: number;
      }>(sql`
        SELECT
          provider,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success = true)::int AS success,
          COUNT(*) FILTER (WHERE success = false)::int AS fail,
          COALESCE(AVG(latency_ms), 0)::int AS avg_latency
        FROM ai_usage_logs
        WHERE created_at >= ${past30d.toISOString()}
        GROUP BY provider
        ORDER BY total DESC
      `);
      res.json({ items: rows.rows });
    } catch (error) {
      console.error("[platform/usage/by-provider] failed:", error);
      res.status(500).json({ message: "取得 provider 統計失敗" });
    }
  });

  /**
   * GET /api/platform/usage/top-fields
   * 用量最高的場域排行（Top 10，過去 30 天）
   */
  app.get("/api/platform/usage/top-fields", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.execute<{
        field_id: string;
        total: number;
        success: number;
        fail: number;
      }>(sql`
        SELECT
          field_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success = true)::int AS success,
          COUNT(*) FILTER (WHERE success = false)::int AS fail
        FROM ai_usage_logs
        WHERE created_at >= ${past30d.toISOString()}
          AND field_id IS NOT NULL
        GROUP BY field_id
        ORDER BY total DESC
        LIMIT 10
      `);

      // join field name
      const fieldIds = rows.rows.map((r) => r.field_id).filter(Boolean);
      const fieldList = fieldIds.length
        ? await db.query.fields.findMany({
            where: inArray(fields.id, fieldIds),
            columns: { id: true, name: true, code: true },
          })
        : [];
      const fieldMap = new Map(fieldList.map((f) => [f.id, f]));

      const enriched = rows.rows.map((r) => ({
        ...r,
        field: fieldMap.get(r.field_id) ?? null,
        successRate: r.total > 0 ? r.success / r.total : 0,
      }));

      res.json({ items: enriched });
    } catch (error) {
      console.error("[platform/usage/top-fields] failed:", error);
      res.status(500).json({ message: "取得場域用量排行失敗" });
    }
  });

  /**
   * GET /api/platform/usage/by-endpoint
   * 各 AI endpoint 用量與成功率（過去 30 天）
   */
  app.get("/api/platform/usage/by-endpoint", requirePlatformAdmin, async (_req, res) => {
    try {
      const past30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db.execute<{
        endpoint: string;
        provider: string;
        total: number;
        success: number;
        fail: number;
        avg_latency: number;
      }>(sql`
        SELECT
          endpoint,
          provider,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success = true)::int AS success,
          COUNT(*) FILTER (WHERE success = false)::int AS fail,
          COALESCE(AVG(latency_ms), 0)::int AS avg_latency
        FROM ai_usage_logs
        WHERE created_at >= ${past30d.toISOString()}
        GROUP BY endpoint, provider
        ORDER BY total DESC
        LIMIT 20
      `);
      res.json({ items: rows.rows });
    } catch (error) {
      console.error("[platform/usage/by-endpoint] failed:", error);
      res.status(500).json({ message: "取得 endpoint 統計失敗" });
    }
  });

  /**
   * GET /api/platform/usage/meters
   * 各場域 meter 用量（field_usage_meters，含超額狀態）
   */
  app.get("/api/platform/usage/meters", requirePlatformAdmin, async (req, res) => {
    try {
      const fieldFilter = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const meterFilter = typeof req.query.meterKey === "string" ? req.query.meterKey : null;

      const conds = [];
      if (fieldFilter) conds.push(eq(fieldUsageMeters.fieldId, fieldFilter));
      if (meterFilter) conds.push(eq(fieldUsageMeters.meterKey, meterFilter));

      const meters = await db.query.fieldUsageMeters.findMany({
        where: conds.length ? and(...conds) : undefined,
        orderBy: [desc(fieldUsageMeters.updatedAt)],
        limit: 200,
      });

      const fieldIds = Array.from(new Set(meters.map((m) => m.fieldId).filter(Boolean) as string[]));
      const fieldList = fieldIds.length
        ? await db.query.fields.findMany({
            where: inArray(fields.id, fieldIds),
            columns: { id: true, name: true, code: true },
          })
        : [];
      const fieldMap = new Map(fieldList.map((f) => [f.id, f]));

      const enriched = meters.map((m) => ({
        ...m,
        field: m.fieldId ? fieldMap.get(m.fieldId) ?? null : null,
        usagePercent: m.limitValue ? (Number(m.currentValue) / Number(m.limitValue)) * 100 : null,
        isOverage: m.limitValue ? Number(m.currentValue) > Number(m.limitValue) : false,
      }));

      res.json({ items: enriched, total: enriched.length });
    } catch (error) {
      console.error("[platform/usage/meters] failed:", error);
      res.status(500).json({ message: "取得用量 meters 失敗" });
    }
  });

  // ============================================================================
  // 🆕 P0-3（2026-04-30）— 計費警示
  // ============================================================================

  /**
   * GET /api/platform/billing-alerts
   * 即時計算所有計費風險（訂閱到期 / 失敗交易 / 逾期付款）
   * 不寫 DB，純讀取當下狀態。前端可定期 refetch。
   *
   * Query: ?type=expiring_soon|expired|failed_payment|overdue
   */
  app.get("/api/platform/billing-alerts", requirePlatformAdmin, async (req, res) => {
    try {
      const typeFilter = typeof req.query.type === "string" ? req.query.type : null;
      const severityFilter = typeof req.query.severity === "string" ? req.query.severity : null;
      const alerts = await scanBillingAlerts();
      const filtered = alerts.filter((a) => {
        if (typeFilter && a.type !== typeFilter) return false;
        if (severityFilter && a.severity !== severityFilter) return false;
        return true;
      });
      res.json({ items: filtered, total: filtered.length });
    } catch (error) {
      console.error("[platform/billing-alerts] failed:", error);
      res.status(500).json({ message: "計算計費警示失敗" });
    }
  });

  /**
   * GET /api/platform/billing-alerts/summary
   * 統計 — 給 dashboard 徽章用
   */
  app.get("/api/platform/billing-alerts/summary", requirePlatformAdmin, async (_req, res) => {
    try {
      const summary = await getBillingAlertSummary();
      res.json(summary);
    } catch (error) {
      console.error("[platform/billing-alerts/summary] failed:", error);
      res.status(500).json({ message: "計算計費統計失敗" });
    }
  });

  // ============================================================================
  // 🆕 P2-1（2026-04-30）— 批量管理工具
  // ============================================================================

  /**
   * POST /api/platform/fields/bulk-status
   * 批量變更場域狀態
   * Body: { fieldIds: string[], status: "active"|"inactive"|"suspended", reason?: string }
   */
  const bulkStatusSchema = z.object({
    fieldIds: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(["active", "inactive", "suspended"]),
    reason: z.string().max(500).optional(),
  });

  app.post("/api/platform/fields/bulk-status", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = bulkStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const { fieldIds, status, reason } = parsed.data;

      // 抓舊狀態給 audit 用
      const oldFields = await db.query.fields.findMany({
        where: inArray(fields.id, fieldIds),
        columns: { id: true, name: true, code: true, status: true },
      });
      const oldMap = new Map(oldFields.map((f) => [f.id, f]));

      // 批量更新
      await db
        .update(fields)
        .set({ status, updatedAt: new Date() })
        .where(inArray(fields.id, fieldIds));

      // 為每個變更寫 audit（一筆一筆寫、簡單容錯）
      for (const f of oldFields) {
        await logAuditAction({
          actorAdminId: req.platform?.adminAccountId ?? undefined,
          action: "platform:bulk_field_status_change",
          targetType: "field",
          targetId: f.id,
          fieldId: f.id,
          metadata: {
            oldStatus: f.status,
            newStatus: status,
            reason,
            batchSize: fieldIds.length,
            actorRole: req.platform?.role,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      res.json({
        success: true,
        updatedCount: oldFields.length,
        skipped: fieldIds.length - oldFields.length,
        items: oldFields.map((f) => ({
          id: f.id,
          name: f.name,
          code: f.code,
          oldStatus: f.status,
          newStatus: status,
        })),
      });
    } catch (error) {
      console.error("[platform/fields/bulk-status] failed:", error);
      res.status(500).json({ message: "批量變更狀態失敗" });
    }
  });

  /**
   * POST /api/platform/fields/bulk-plan
   * 批量變更場域訂閱方案
   * Body: { fieldIds: string[], planId: string, billingCycle?: "monthly"|"yearly" }
   */
  const bulkPlanSchema = z.object({
    fieldIds: z.array(z.string().uuid()).min(1).max(100),
    planId: z.string().uuid(),
    billingCycle: z.enum(["monthly", "yearly"]).optional(),
  });

  app.post("/api/platform/fields/bulk-plan", requirePlatformAdmin, async (req, res) => {
    try {
      const parsed = bulkPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "資料格式錯誤", errors: parsed.error.errors });
      }

      const { fieldIds, planId, billingCycle } = parsed.data;

      // 確認方案存在
      const plan = await db.query.platformPlans.findFirst({
        where: eq(platformPlans.id, planId),
      });
      if (!plan) return res.status(404).json({ message: "方案不存在" });

      const updated: Array<{ fieldId: string; subscriptionId: string; action: "create" | "update" }> = [];

      // 對每個 fieldId 個別處理（同一場域可能已有 subscription）
      for (const fieldId of fieldIds) {
        const existing = await db.query.fieldSubscriptions.findFirst({
          where: eq(fieldSubscriptions.fieldId, fieldId),
        });
        let action: "create" | "update";
        let subId: string;

        if (existing) {
          const [sub] = await db
            .update(fieldSubscriptions)
            .set({
              planId,
              billingCycle: billingCycle ?? existing.billingCycle,
              updatedAt: new Date(),
            })
            .where(eq(fieldSubscriptions.id, existing.id))
            .returning();
          subId = sub.id;
          action = "update";
        } else {
          const [sub] = await db
            .insert(fieldSubscriptions)
            .values({
              fieldId,
              planId,
              status: "active",
              billingCycle: billingCycle ?? "monthly",
            })
            .returning();
          subId = sub.id;
          action = "create";
        }

        updated.push({ fieldId, subscriptionId: subId, action });

        // 每個變更寫 audit
        await logAuditAction({
          actorAdminId: req.platform?.adminAccountId ?? undefined,
          action: action === "update" ? "platform:bulk_field_plan_change" : "platform:bulk_field_plan_create",
          targetType: "field_subscription",
          targetId: subId,
          fieldId,
          metadata: {
            planId,
            planCode: plan.code,
            planName: plan.name,
            billingCycle: billingCycle ?? "monthly",
            batchSize: fieldIds.length,
            actorRole: req.platform?.role,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      res.json({
        success: true,
        updatedCount: updated.filter((u) => u.action === "update").length,
        createdCount: updated.filter((u) => u.action === "create").length,
        items: updated,
      });
    } catch (error) {
      console.error("[platform/fields/bulk-plan] failed:", error);
      res.status(500).json({ message: "批量變更方案失敗" });
    }
  });

  /**
   * GET /api/platform/audit-logs
   * Query params:
   *   ?fieldId=xxx — 過濾特定場域
   *   ?actorAdminId=xxx — 過濾特定操作者
   *   ?action=xxx — 過濾特定動作（支援前綴匹配）
   *   ?targetType=xxx — 過濾資源類型
   *   ?from=ISO-date&to=ISO-date — 時間範圍
   *   ?limit=100 (max 500) — 預設 100
   *   ?cursor=createdAt-iso — 分頁
   */
  app.get("/api/platform/audit-logs", requirePlatformAdmin, async (req, res) => {
    try {
      const fieldId = typeof req.query.fieldId === "string" ? req.query.fieldId : null;
      const actorAdminId = typeof req.query.actorAdminId === "string" ? req.query.actorAdminId : null;
      const action = typeof req.query.action === "string" ? req.query.action : null;
      const targetType = typeof req.query.targetType === "string" ? req.query.targetType : null;
      const fromStr = typeof req.query.from === "string" ? req.query.from : null;
      const toStr = typeof req.query.to === "string" ? req.query.to : null;
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

      const conditions = [];
      if (fieldId) conditions.push(eq(auditLogs.fieldId, fieldId));
      if (actorAdminId) conditions.push(eq(auditLogs.actorAdminId, actorAdminId));
      if (action) {
        // 支援精確匹配與前綴（"platform:" 配對所有平台動作）
        conditions.push(sql`${auditLogs.action} LIKE ${action.endsWith(":") ? action + "%" : action}`);
      }
      if (targetType) conditions.push(eq(auditLogs.targetType, targetType));
      if (fromStr) {
        const fromDate = new Date(fromStr);
        if (!Number.isNaN(fromDate.getTime())) conditions.push(gte(auditLogs.createdAt, fromDate));
      }
      if (toStr) {
        const toDate = new Date(toStr);
        if (!Number.isNaN(toDate.getTime())) conditions.push(lte(auditLogs.createdAt, toDate));
      }
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!Number.isNaN(cursorDate.getTime())) conditions.push(lte(auditLogs.createdAt, cursorDate));
      }

      const logs = await db.query.auditLogs.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(auditLogs.createdAt)],
        limit: limit + 1, // 多抓 1 筆判斷是否還有下一頁
      });

      const hasMore = logs.length > limit;
      const items = hasMore ? logs.slice(0, limit) : logs;

      // 一次性 join admin accounts + fields（避免 N+1）
      const actorIds = Array.from(new Set(items.map((l) => l.actorAdminId).filter(Boolean) as string[]));
      const fieldIds = Array.from(new Set(items.map((l) => l.fieldId).filter(Boolean) as string[]));

      const [actors, fieldsList] = await Promise.all([
        actorIds.length
          ? db.query.adminAccounts.findMany({
              where: inArray(adminAccountsTable.id, actorIds),
              columns: { id: true, username: true, displayName: true, fieldId: true },
            })
          : Promise.resolve([]),
        fieldIds.length
          ? db.query.fields.findMany({
              where: inArray(fields.id, fieldIds),
              columns: { id: true, name: true, code: true },
            })
          : Promise.resolve([]),
      ]);

      const actorMap = new Map(actors.map((a) => [a.id, a]));
      const fieldMap = new Map(fieldsList.map((f) => [f.id, f]));

      const enriched = items.map((log) => ({
        ...log,
        actor: log.actorAdminId ? actorMap.get(log.actorAdminId) ?? null : null,
        field: log.fieldId ? fieldMap.get(log.fieldId) ?? null : null,
      }));

      res.json({
        items: enriched,
        nextCursor: hasMore && items[items.length - 1].createdAt
          ? items[items.length - 1].createdAt!.toISOString()
          : null,
      });
    } catch (error) {
      console.error("[platform/audit-logs] failed:", error);
      res.status(500).json({ message: "取得稽核日誌失敗" });
    }
  });

  /**
   * GET /api/platform/audit-logs/stats
   * 提供統計：今日操作數、本月操作數、最常見動作、操作最頻繁的 admin
   */
  app.get("/api/platform/audit-logs/stats", requirePlatformAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayCount, monthCount, topActions, topActors] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(gte(auditLogs.createdAt, todayStart))
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(gte(auditLogs.createdAt, monthStart))
          .then((r) => Number(r[0]?.count ?? 0)),
        db.execute<{ action: string; count: number }>(sql`
          SELECT action, COUNT(*)::int AS count
          FROM audit_logs
          WHERE created_at >= ${monthStart.toISOString()}
          GROUP BY action
          ORDER BY count DESC
          LIMIT 10
        `).then((r) => r.rows),
        db.execute<{ actorAdminId: string; count: number }>(sql`
          SELECT actor_admin_id AS "actorAdminId", COUNT(*)::int AS count
          FROM audit_logs
          WHERE created_at >= ${monthStart.toISOString()}
            AND actor_admin_id IS NOT NULL
          GROUP BY actor_admin_id
          ORDER BY count DESC
          LIMIT 5
        `).then((r) => r.rows),
      ]);

      res.json({
        todayCount,
        monthCount,
        topActions,
        topActors,
      });
    } catch (error) {
      console.error("[platform/audit-logs/stats] failed:", error);
      res.status(500).json({ message: "取得稽核統計失敗" });
    }
  });
}
