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
  insertPlatformPlanSchema,
  insertPlatformFeatureFlagSchema,
  insertFieldFeatureOverrideSchema,
} from "@shared/schema";
import { requirePlatformAdmin } from "../platformAuth";
import { logAuditAction } from "../adminAuth";
import { auditLogs, adminAccounts as adminAccountsTable } from "@shared/schema";
import { eq, sql, desc, and, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";

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

  // ============================================================================
  // 🆕 P0-1（2026-04-30）— 平台稽核日誌
  //   重用既有 audit_logs 表，提供跨場域查詢介面
  //   action 前綴 platform: 為平台層操作（vs admin: 為場域層）
  // ============================================================================

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
