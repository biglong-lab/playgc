import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
import { db } from "../db";
import { fields, parseFieldSettings, games, roles, rolePermissions, permissions, adminAccounts } from "@shared/schema";
import type { FieldSettings, FieldTheme } from "@shared/schema";
import { insertFieldSchema } from "@shared/schema";
import { encryptApiKey, decryptApiKey } from "../lib/crypto";
import { z } from "zod";
import { eq, desc, inArray } from "drizzle-orm";

/** 🆕 公告是否在有效期間內 — API 層決定要不要回傳 */
function isAnnouncementActive(settings: { announcement?: string; announcementStartAt?: string; announcementEndAt?: string }): boolean {
  if (!settings.announcement?.trim()) return false;
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD（UTC）
  if (settings.announcementStartAt && today < settings.announcementStartAt) return false;
  if (settings.announcementEndAt && today > settings.announcementEndAt) return false;
  return true;
}

/**
 * 🆕 為新場域 seed 一組預設角色，避免第一次授權管理員時卡住沒 role 可選
 * - 場域管理員：所有系統權限（給場域初始管理員用）
 * - 活動執行者：受限於當場運營（可看遊戲、管 session、QR 現場查驗）
 * 可同時補舊場域（若場域 roles=0 呼叫此函式）。
 */
async function seedDefaultRolesForField(fieldId: string, actorAdminId: string | null) {
  // 拉全部 permission keys
  const allPermissions = await db.select({ id: permissions.id, key: permissions.key }).from(permissions);
  if (allPermissions.length === 0) {
    // 系統連 permission 都沒有 — 安全起見直接跳出（避免建立空 role 混淆）
    return;
  }

  const permByKey = new Map(allPermissions.map((p) => [p.key, p.id]));
  const resolveIds = (keys: string[]) =>
    keys.map((k) => permByKey.get(k)).filter((id): id is string => !!id);

  // 1) 場域管理員 — 給全部權限（第一個被授權的人通常是 owner）
  const [adminRole] = await db.insert(roles).values({
    name: "場域管理員",
    description: "場域最高管理權限，可管理所有功能（建立場域時自動生成）",
    systemRole: "field_director",
    fieldId,
    isCustom: false,
    isDefault: true,
  }).returning();

  await db.insert(rolePermissions).values(
    allPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
      allow: true,
    })),
  );

  // 2) 活動執行者 — 只給現場營運權限
  const executorPermIds = resolveIds([
    "game:view",
    "session:manage",
    "qr:scan_check",
    "qr:view",
    "leaderboard:view",
    "user:view",
  ]);

  if (executorPermIds.length > 0) {
    const [executorRole] = await db.insert(roles).values({
      name: "活動執行者",
      description: "現場活動執行權限（檢視遊戲、管理場次、QR 查驗）",
      systemRole: "field_executor",
      fieldId,
      isCustom: false,
      isDefault: true,
    }).returning();

    await db.insert(rolePermissions).values(
      executorPermIds.map((permissionId) => ({
        roleId: executorRole.id,
        permissionId,
        allow: true,
      })),
    );
  }

  // 記 audit log（只在有 actor 時）
  if (actorAdminId) {
    await logAuditAction({
      actorAdminId,
      action: "role:seed_defaults",
      targetType: "field",
      targetId: fieldId,
      fieldId,
      metadata: { seeded: ["場域管理員", "活動執行者"] },
    });
  }
}

/**
 * 🆕 自動把建場域的人（req.admin）設為新場域的「場域管理員」
 * 做法：為該 Firebase user 在新場域建立一個 admin_account，綁到剛 seed 的 director role。
 * 前提：seedDefaultRolesForField 已先執行完成，新場域已有 director role。
 */
async function autoAssignCreatorAsFieldDirector(
  newFieldId: string,
  creatorAccountId: string | undefined,
) {
  if (!creatorAccountId) return;

  // 找建立者在自己場域的 admin_account（取得 firebaseUserId / email / displayName）
  const creatorAccount = await db.query.adminAccounts.findFirst({
    where: eq(adminAccounts.id, creatorAccountId),
  });
  if (!creatorAccount) return;

  // 沒 firebaseUserId 且沒 email → 無法綁回使用者，放棄
  if (!creatorAccount.firebaseUserId && !creatorAccount.email) return;

  // 找新場域剛 seed 的「場域管理員」role
  const [directorRole] = await db.select().from(roles).where(
    eq(roles.fieldId, newFieldId),
  );
  if (!directorRole) return; // seed 失敗時跳過

  // 找同時是 isDefault + systemRole=field_director 的 role（若 select 結果含多筆）
  const targetRole = await db.query.roles.findFirst({
    where: (r, { and: a, eq: e }) =>
      a(e(r.fieldId, newFieldId), e(r.systemRole, "field_director")),
  });
  if (!targetRole) return;

  // 避免重複：若建立者已在新場域有 admin_account 就跳過
  const existing = creatorAccount.firebaseUserId
    ? await db.query.adminAccounts.findFirst({
        where: (a, { and, eq: e }) =>
          and(
            e(a.fieldId, newFieldId),
            e(a.firebaseUserId, creatorAccount.firebaseUserId!),
          ),
      })
    : creatorAccount.email
      ? await db.query.adminAccounts.findFirst({
          where: (a, { and, eq: e }) =>
            and(e(a.fieldId, newFieldId), e(a.email, creatorAccount.email!)),
        })
      : null;

  if (existing) return;

  // 建立新場域的 admin_account
  const [newAccount] = await db
    .insert(adminAccounts)
    .values({
      fieldId: newFieldId,
      firebaseUserId: creatorAccount.firebaseUserId,
      email: creatorAccount.email,
      displayName: creatorAccount.displayName,
      username: creatorAccount.username, // 若有 legacy username 也複製
      roleId: targetRole.id,
      status: "active",
    })
    .returning();

  // 記 audit log
  await logAuditAction({
    actorAdminId: creatorAccountId,
    action: "field:auto_assign_creator",
    targetType: "admin_account",
    targetId: newAccount.id,
    fieldId: newFieldId,
    metadata: {
      roleId: targetRole.id,
      roleName: targetRole.name,
      firebaseUserId: creatorAccount.firebaseUserId,
      email: creatorAccount.email,
    },
  });
}

/** 🎨 驗證主題欄位（防 XSS） */
const hexColorRegex = /^#[0-9a-f]{6}$/i;
const safeUrlRegex = /^https:\/\/[\w.-]+(:\d+)?(\/[^\s]*)?$/i;

const fieldThemeSchema = z
  .object({
    colorScheme: z.enum(["dark", "light", "custom"]).optional(),
    primaryColor: z.string().regex(hexColorRegex).optional(),
    accentColor: z.string().regex(hexColorRegex).optional(),
    backgroundColor: z.string().regex(hexColorRegex).optional(),
    textColor: z.string().regex(hexColorRegex).optional(),
    layoutTemplate: z
      .enum(["classic", "card", "fullscreen", "minimal"])
      .optional(),
    coverImageUrl: z.string().regex(safeUrlRegex).optional().or(z.literal("")),
    brandingLogoUrl: z.string().regex(safeUrlRegex).optional().or(z.literal("")),
    fontFamily: z.enum(["default", "serif", "mono", "display"]).optional(),
  })
  .strict();

export function registerAdminFieldRoutes(app: Express) {
  // ============================================================================
  // Field Management Routes - 場域管理
  // ============================================================================

  app.get("/api/admin/fields", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      if (req.admin.systemRole === "super_admin") {
        const allFields = await db.query.fields.findMany({
          orderBy: [desc(fields.createdAt)],
        });
        return res.json(allFields);
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.admin.fieldId),
      });
      res.json(field ? [field] : []);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  // 🆕 為已存在但沒有角色的場域補 seed 預設角色（例如升級前建立的舊場域）
  // 只有 super_admin 能對任一場域呼叫；一般 admin 只能呼叫自己場域
  app.post("/api/admin/fields/:id/seed-default-roles", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const fieldId = req.params.id;

      // 權限：super_admin 不限、其他要是自己場域
      if (req.admin.systemRole !== "super_admin" && req.admin.fieldId !== fieldId) {
        return res.status(403).json({ message: "無權為此場域補建預設角色" });
      }

      // 檢查場域存在
      const existingField = await db.query.fields.findFirst({ where: eq(fields.id, fieldId) });
      if (!existingField) {
        return res.status(404).json({ message: "場域不存在" });
      }

      // 已經有角色就不重複 seed，避免 duplicate
      const existingRoles = await db.query.roles.findMany({ where: eq(roles.fieldId, fieldId) });
      if (existingRoles.length > 0) {
        return res.status(400).json({
          message: "此場域已有角色，請直接在角色管理頁面編輯",
          existingCount: existingRoles.length,
        });
      }

      await seedDefaultRolesForField(fieldId, req.admin.id);
      res.json({ message: "預設角色已建立", seeded: ["場域管理員", "活動執行者"] });
    } catch (error) {
      console.error("[admin-fields] seed-default-roles failed:", error);
      res.status(500).json({ message: "建立預設角色失敗" });
    }
  });

  app.post("/api/admin/fields", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      // 🔒 Critical #10 修：建立新場域是平台級操作，只允許 super_admin / platform_admin
      // 防止 field-manager 無限增生場域 + 自動取得管理權（DoS DB / 攻擊面）
      if (
        req.admin.systemRole !== "super_admin" &&
        req.admin.systemRole !== "platform_admin"
      ) {
        return res.status(403).json({
          message: "只有平台管理員可建立新場域，請聯繫平台管理員",
        });
      }

      const data = insertFieldSchema.parse(req.body);
      const [field] = await db.insert(fields).values({
        ...data,
        code: data.code.toUpperCase(),
      }).returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:create",
        targetType: "field",
        targetId: field.id,
        fieldId: field.id,
        metadata: { name: field.name },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 🆕 自動 seed 預設角色（場域管理員 + 活動執行者），避免初次授權卡住
      // 失敗不回滾場域建立，只記 log — 後續可用 /api/admin/fields/:id/seed-roles 手動補
      try {
        await seedDefaultRolesForField(field.id, req.admin.id);
      } catch (seedErr) {
        console.error(`[admin-fields] seedDefaultRolesForField failed for field ${field.id}:`, seedErr);
      }

      // 🆕 自動指派建立者為新場域的場域管理員
      // 若建立者有 email / firebaseUserId，建一個 admin_account 綁到新場域的「場域管理員」role
      // 讓建立者切到新場域時立刻有完整管理權限，不用再走一次授權流程
      try {
        await autoAssignCreatorAsFieldDirector(field.id, req.admin.accountId);
      } catch (assignErr) {
        console.error(`[admin-fields] auto-assign creator failed for field ${field.id}:`, assignErr);
      }

      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  app.patch("/api/admin/fields/:id", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權修改此場域" });
      }

      const existingField = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
      });

      if (!existingField) {
        return res.status(404).json({ message: "場域不存在" });
      }

      const data = insertFieldSchema.partial().parse(req.body);

      // 檢查是否要變更場域編號
      if (data.code && data.code !== existingField.code) {
        // 非超級管理員需檢查 6 個月鎖定
        if (req.admin.systemRole !== "super_admin") {
          if (existingField.codeLastChangedAt) {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            if (existingField.codeLastChangedAt > sixMonthsAgo) {
              const nextChangeDate = new Date(existingField.codeLastChangedAt);
              nextChangeDate.setMonth(nextChangeDate.getMonth() + 6);
              return res.status(403).json({
                message: `場域編號在六個月內已變更過，下次可變更時間：${nextChangeDate.toLocaleDateString("zh-TW")}`,
                nextChangeDate: nextChangeDate.toISOString(),
              });
            }
          }
        }

        // 檢查新編號是否唯一
        const existingCode = await db.query.fields.findFirst({
          where: eq(fields.code, data.code.toUpperCase()),
        });

        if (existingCode && existingCode.id !== req.params.id) {
          return res.status(400).json({ message: "此場域編號已被使用" });
        }

        data.code = data.code.toUpperCase();
        data.codeLastChangedAt = new Date();
      }

      const [field] = await db.update(fields)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(fields.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:update",
        targetType: "field",
        targetId: field.id,
        fieldId: field.id,
        metadata: { ...data, codeChanged: data.code !== existingField.code },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(field);
    } catch (error) {
      res.status(500).json({ message: "Failed to update field" });
    }
  });

  // ============================================================================
  // Field Settings — 場域進階設定（AI Key、配額、功能開關）
  // ============================================================================

  // GET /api/admin/fields/:id/settings — 取得場域設定（Key 遮罩）
  app.get("/api/admin/fields/:id/settings", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      // 非 super_admin 只能存取自己的場域
      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權存取此場域設定" });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const settings = parseFieldSettings(field.settings);

      // 遮罩 API Key：只回傳是否已設定，不回傳明文
      return res.json({
        ...settings,
        geminiApiKey: undefined,
        hasGeminiApiKey: Boolean(settings.geminiApiKey),
      });
    } catch (error) {
      return res.status(500).json({ message: "取得設定失敗" });
    }
  });

  // PATCH /api/admin/fields/:id/settings — 更新場域設定
  app.patch("/api/admin/fields/:id/settings", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權修改此場域設定" });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const currentSettings = parseFieldSettings(field.settings);
      const body = req.body as Record<string, unknown>;

      // 合併設定（不可變模式）
      const updatedSettings: FieldSettings = { ...currentSettings };

      // AI Key 處理：新值 → 加密存儲；空字串 → 清除
      if (typeof body.geminiApiKey === "string") {
        if (body.geminiApiKey.trim()) {
          updatedSettings.geminiApiKey = encryptApiKey(body.geminiApiKey.trim());
        } else {
          updatedSettings.geminiApiKey = undefined;
        }
      }

      // 布林開關
      if (typeof body.enableAI === "boolean") updatedSettings.enableAI = body.enableAI;
      if (typeof body.enablePayment === "boolean") updatedSettings.enablePayment = body.enablePayment;
      if (typeof body.enableTeamMode === "boolean") updatedSettings.enableTeamMode = body.enableTeamMode;
      if (typeof body.enableCompetitiveMode === "boolean") updatedSettings.enableCompetitiveMode = body.enableCompetitiveMode;

      // 🆕 場域模組開關
      if (typeof body.enableShootingMission === "boolean") updatedSettings.enableShootingMission = body.enableShootingMission;
      if (typeof body.enableBattleArena === "boolean") updatedSettings.enableBattleArena = body.enableBattleArena;
      if (typeof body.enableChapters === "boolean") updatedSettings.enableChapters = body.enableChapters;
      if (typeof body.enablePhotoMission === "boolean") updatedSettings.enablePhotoMission = body.enablePhotoMission;
      if (typeof body.enableGpsMission === "boolean") updatedSettings.enableGpsMission = body.enableGpsMission;

      // 🆕 場域行銷內容
      if (typeof body.tagline === "string") {
        updatedSettings.tagline = body.tagline.slice(0, 200).trim() || undefined;
      }
      // 🆕 場域公告（最多 500 字）
      if (typeof body.announcement === "string") {
        updatedSettings.announcement = body.announcement.slice(0, 500).trim() || undefined;
      }
      // 🆕 公告時效（ISO YYYY-MM-DD，空字串 = 清除）
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (typeof body.announcementStartAt === "string") {
        const v = body.announcementStartAt.trim();
        updatedSettings.announcementStartAt = isoDateRegex.test(v) ? v : undefined;
      }
      if (typeof body.announcementEndAt === "string") {
        const v = body.announcementEndAt.trim();
        updatedSettings.announcementEndAt = isoDateRegex.test(v) ? v : undefined;
      }
      if (body.announcementSeverity === "urgent" || body.announcementSeverity === "info") {
        updatedSettings.announcementSeverity = body.announcementSeverity;
      }
      if (Array.isArray(body.highlights)) {
        const highlightSchema = z.object({
          icon: z.string().max(50).optional(),
          title: z.string().min(1).max(50),
          description: z.string().max(200).optional(),
        });
        const parsed = z.array(highlightSchema).max(10).safeParse(body.highlights);
        if (!parsed.success) {
          return res.status(400).json({
            message: "亮點格式錯誤（最多 10 項，title 必填）",
            errors: parsed.error.errors,
          });
        }
        updatedSettings.highlights = parsed.data;
      }

      // 數值
      if (typeof body.maxGames === "number") updatedSettings.maxGames = Math.max(0, Math.round(body.maxGames));
      if (typeof body.maxConcurrentSessions === "number") {
        updatedSettings.maxConcurrentSessions = Math.max(0, Math.round(body.maxConcurrentSessions));
      }

      // 品牌（legacy，仍支援舊端點）
      if (typeof body.primaryColor === "string") updatedSettings.primaryColor = body.primaryColor;
      if (typeof body.welcomeMessage === "string") updatedSettings.welcomeMessage = body.welcomeMessage;

      // 🆕 視覺主題（v2）— 整塊替換／合併
      if (body.theme && typeof body.theme === "object") {
        const parsed = fieldThemeSchema.safeParse(body.theme);
        if (!parsed.success) {
          return res.status(400).json({
            message: "主題設定格式錯誤",
            errors: parsed.error.errors,
          });
        }
        updatedSettings.theme = {
          ...(updatedSettings.theme || {}),
          ...(parsed.data as FieldTheme),
        };
      }

      await db.update(fields)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(fields.id, req.params.id));

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:update_settings",
        targetType: "field",
        targetId: req.params.id,
        fieldId: req.params.id,
        metadata: {
          updatedKeys: Object.keys(body),
          apiKeyChanged: typeof body.geminiApiKey === "string",
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 回傳遮罩版本
      return res.json({
        ...updatedSettings,
        geminiApiKey: undefined,
        hasGeminiApiKey: Boolean(updatedSettings.geminiApiKey),
      });
    } catch (error) {
      return res.status(500).json({ message: "更新設定失敗" });
    }
  });

  // ============================================================================
  // 🌐 GET /api/fields/public — 公開：列出所有 active 場域（給 FieldEntry 選擇）
  //     擴充回傳：tagline / coverImageUrl / highlights / gameCount / topGameCovers / 模組開關
  // ============================================================================
  app.get("/api/fields/public", async (_req, res) => {
    try {
      const rows = await db.query.fields.findMany({
        where: eq(fields.status, "active"),
        columns: {
          id: true,
          code: true,
          name: true,
          description: true,
          logoUrl: true,
          status: true,
          settings: true,
        },
        orderBy: [desc(fields.createdAt)],
      });

      // 批次撈每個場域的 published 遊戲 —— 用於 gameCount 和 topGameCovers
      const allGames = rows.length
        ? await db.query.games.findMany({
            where: eq(games.status, "published"),
            columns: {
              id: true,
              fieldId: true,
              title: true,
              coverImageUrl: true,
              createdAt: true,
            },
          })
        : [];

      const payload = rows.map((field) => {
        const settings = parseFieldSettings(field.settings);
        const theme = settings.theme || {};
        const fieldGames = allGames
          .filter((g) => g.fieldId === field.id)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

        return {
          id: field.id,
          code: field.code,
          name: field.name,
          description: field.description,
          logoUrl: theme.brandingLogoUrl || field.logoUrl || null,
          status: field.status,
          // 🆕 marketing content
          tagline: settings.tagline || null,
          announcement: isAnnouncementActive(settings) ? settings.announcement : null,
          announcementEndAt: settings.announcementEndAt ?? null,
          announcementSeverity: settings.announcementSeverity ?? "info",
          coverImageUrl: theme.coverImageUrl || null,
          highlights: settings.highlights || [],
          // 🆕 stats
          gameCount: fieldGames.length,
          topGameCovers: fieldGames
            .slice(0, 3)
            .map((g) => ({ id: g.id, title: g.title, coverImageUrl: g.coverImageUrl }))
            .filter((g) => g.coverImageUrl),
          // 🆕 modules（讓前端知道要不要秀對戰入口等）
          modules: {
            shooting: !!settings.enableShootingMission,
            battle: !!settings.enableBattleArena,
            chapters: !!settings.enableChapters,
            photo: !!settings.enablePhotoMission,
            gps: !!settings.enableGpsMission,
            team: settings.enableTeamMode !== false, // 預設 true
            competitive: settings.enableCompetitiveMode !== false, // 預設 true
            payment: !!settings.enablePayment, // 🆕 財務中心菜單控制
          },
        };
      });

      res.set("Cache-Control", "public, max-age=300");
      res.json(payload);
    } catch (error) {
      console.error("[fields/public] failed:", error);
      res.status(500).json({ message: "取得場域列表失敗" });
    }
  });

  // ============================================================================
  // 🌐 GET /api/fields/:code/theme — 公開端點，玩家端用來套場域主題
  // ============================================================================
  app.get("/api/fields/:code/theme", async (req, res) => {
    try {
      const code = String(req.params.code || "").toUpperCase();
      const field = await db.query.fields.findFirst({
        where: eq(fields.code, code),
        columns: {
          id: true,
          code: true,
          name: true,
          logoUrl: true,
          settings: true,
        },
      });

      if (!field || field.id === undefined) {
        return res.status(404).json({ message: "場域不存在" });
      }

      const settings = parseFieldSettings(field.settings);
      const theme = settings.theme || {};
      // legacy fallback：舊的 settings.primaryColor
      const primaryColor = theme.primaryColor || settings.primaryColor;

      res.set("Cache-Control", "public, max-age=300");
      return res.json({
        fieldId: field.id,
        code: field.code,
        name: field.name,
        logoUrl: theme.brandingLogoUrl || field.logoUrl || null,
        welcomeMessage: settings.welcomeMessage || null,
        // 🆕 場域行銷內容（公告依時效過濾；endAt + severity 前端用來顯示倒數和視覺）
        tagline: settings.tagline || null,
        announcement: isAnnouncementActive(settings) ? settings.announcement : null,
        announcementSeverity: settings.announcementSeverity ?? "info",
        announcementEndAt: settings.announcementEndAt ?? null,
        highlights: settings.highlights || [],
        // 🆕 模組開關（Landing / Home / 後台菜單控制）
        modules: {
          shooting: !!settings.enableShootingMission,
          battle: !!settings.enableBattleArena,
          chapters: !!settings.enableChapters,
          photo: !!settings.enablePhotoMission,
          gps: !!settings.enableGpsMission,
          team: settings.enableTeamMode !== false,
          competitive: settings.enableCompetitiveMode !== false,
          payment: !!settings.enablePayment,
        },
        theme: {
          colorScheme: theme.colorScheme || "dark",
          primaryColor: primaryColor || null,
          accentColor: theme.accentColor || null,
          backgroundColor: theme.backgroundColor || null,
          textColor: theme.textColor || null,
          layoutTemplate: theme.layoutTemplate || "classic",
          coverImageUrl: theme.coverImageUrl || null,
          brandingLogoUrl: theme.brandingLogoUrl || null,
          fontFamily: theme.fontFamily || "default",
        },
        // 🆕 新場域首次登入引導旗標 — 給 FieldOnboardingWizard 決定要不要自動彈
        hasCompletedOnboarding: !!settings.hasCompletedOnboarding,
      });
    } catch (error) {
      console.error("[fields/theme]", error);
      return res.status(500).json({ message: "取得場域主題失敗" });
    }
  });

  // ============================================================================
  // 🚚 POST /api/admin/games/:gameId/move-field — super_admin 搬移遊戲到其他場域
  // ============================================================================
  app.post(
    "/api/admin/games/:gameId/move-field",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        // ⚠️ 只有 super_admin 可搬移（跨場域是平台級操作）
        if (req.admin.systemRole !== "super_admin") {
          return res.status(403).json({
            message: "僅平台超級管理員可搬移遊戲到其他場域",
          });
        }

        const bodySchema = z.object({
          targetFieldId: z.string().min(1),
        });
        const { targetFieldId } = bodySchema.parse(req.body);

        const gameId = req.params.gameId;

        // 驗證 game 存在
        const game = await db.query.games.findFirst({
          where: eq(games.id, gameId),
        });
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        // 驗證目標場域存在
        const targetField = await db.query.fields.findFirst({
          where: eq(fields.id, targetFieldId),
        });
        if (!targetField) {
          return res.status(404).json({ message: "目標場域不存在" });
        }

        // 沒差就直接回 200（冪等）
        if (game.fieldId === targetFieldId) {
          return res.json({
            message: "遊戲已在目標場域，無需搬移",
            game,
          });
        }

        const fromFieldId = game.fieldId;

        // 執行搬移
        const [updated] = await db
          .update(games)
          .set({ fieldId: targetFieldId, updatedAt: new Date() })
          .where(eq(games.id, gameId))
          .returning();

        await logAuditAction({
          actorAdminId: req.admin.id,
          action: "game:move_field",
          targetType: "game",
          targetId: gameId,
          fieldId: targetFieldId,
          metadata: {
            fromFieldId,
            toFieldId: targetFieldId,
            targetFieldName: targetField.name,
            gameTitle: game.title,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        return res.json({
          message: `遊戲「${game.title}」已搬移到「${targetField.name}」`,
          game: updated,
          fromFieldId,
          toFieldId: targetFieldId,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "參數錯誤", errors: error.errors });
        }
        console.error("[game:move-field]", error);
        return res.status(500).json({ message: "搬移遊戲失敗" });
      }
    },
  );
}
