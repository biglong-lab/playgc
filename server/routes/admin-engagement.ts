// 場域行銷設定 admin API
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13 §14 §16 §18
//
// 端點：
//   GET  /api/admin/engagement/settings/:fieldId
//   PUT  /api/admin/engagement/settings/:fieldId
//
//   GET    /api/admin/engagement/channels?fieldId=
//   POST   /api/admin/engagement/channels
//   PATCH  /api/admin/engagement/channels/:id
//   DELETE /api/admin/engagement/channels/:id
//
//   GET /api/admin/engagement/welcome-squads/:fieldId   — 取得當下歡迎隊伍清單（自動計算）
//   POST /api/admin/engagement/test-notification/:channelId — 測試發送通知
//
import type { Express } from "express";
import { db } from "../db";
import {
  fieldEngagementSettings,
  notificationChannels,
  squadStats,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";
import { z } from "zod";

export function registerAdminEngagementRoutes(app: Express) {
  // ============================================================================
  // GET /api/admin/engagement/settings/:fieldId — 取設定（沒有則回預設值）
  // ============================================================================
  app.get(
    "/api/admin/engagement/settings/:fieldId",
    requireAdminAuth,
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;
        const [settings] = await db
          .select()
          .from(fieldEngagementSettings)
          .where(eq(fieldEngagementSettings.fieldId, fieldId));

        if (settings) {
          res.json(settings);
        } else {
          // 回 schema 預設值（讓前端可以直接綁定）
          res.json({
            fieldId,
            superLeaderMinGames: 100,
            superLeaderMinRecruits: 10,
            superLeaderMinFields: 2,
            superLeaderMinWinRate: 50,
            superLeaderAutoEnabled: true,
            superLeaderManualIds: [],
            welcomeMode: "auto",
            welcomeAutoTopN: 5,
            welcomeAutoCriteria: "total_games",
            welcomeManualIds: [],
            notificationChannels: ["in_app"],
            notifyOnFirstGame: true,
            notifyOnRankChange: true,
            notifyOnRewardIssued: true,
            notifyOnTierUpgrade: true,
            notifyOnDormancyWarning: true,
            notificationCooldownHours: 24,
            dormancyDaysThreshold: 30,
            dormancyWarningDays: [3, 7, 14],
            tierGamesThresholds: {
              newbie: 1,
              active: 10,
              veteran: 50,
              legend: 100,
            },
            isDefault: true, // 標記是預設值，admin 第一次儲存才會 insert
          });
        }
      } catch (error) {
        console.error("[admin-engagement] GET settings 失敗:", error);
        res.status(500).json({ error: "取得設定失敗" });
      }
    },
  );

  // ============================================================================
  // PUT /api/admin/engagement/settings/:fieldId — upsert 設定
  // ============================================================================
  const upsertSettingsSchema = z.object({
    superLeaderMinGames: z.number().int().min(1).optional(),
    superLeaderMinRecruits: z.number().int().min(0).optional(),
    superLeaderMinFields: z.number().int().min(1).optional(),
    superLeaderMinWinRate: z.number().int().min(0).max(100).optional(),
    superLeaderAutoEnabled: z.boolean().optional(),
    superLeaderManualIds: z.array(z.string()).optional(),

    welcomeMode: z.enum(["auto", "manual", "hybrid"]).optional(),
    welcomeAutoTopN: z.number().int().min(1).max(20).optional(),
    welcomeAutoCriteria: z.enum(["total_games", "rating", "recent_active"]).optional(),
    welcomeManualIds: z.array(z.string()).optional(),

    notificationChannels: z.array(z.string()).optional(),
    notifyOnFirstGame: z.boolean().optional(),
    notifyOnRankChange: z.boolean().optional(),
    notifyOnRewardIssued: z.boolean().optional(),
    notifyOnTierUpgrade: z.boolean().optional(),
    notifyOnDormancyWarning: z.boolean().optional(),
    notificationCooldownHours: z.number().int().min(0).max(720).optional(),

    dormancyDaysThreshold: z.number().int().min(1).max(365).optional(),
    dormancyWarningDays: z.array(z.number().int()).optional(),

    tierGamesThresholds: z
      .object({
        newbie: z.number().int().optional(),
        active: z.number().int().optional(),
        veteran: z.number().int().optional(),
        legend: z.number().int().optional(),
      })
      .optional(),
  });

  app.put(
    "/api/admin/engagement/settings/:fieldId",
    requireAdminAuth,
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;
        const parsed = upsertSettingsSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.errors[0]?.message ?? "驗證失敗",
          });
        }

        // upsert（PostgreSQL ON CONFLICT）
        const [result] = await db
          .insert(fieldEngagementSettings)
          .values({ fieldId, ...parsed.data })
          .onConflictDoUpdate({
            target: fieldEngagementSettings.fieldId,
            set: { ...parsed.data, updatedAt: new Date() },
          })
          .returning();

        res.json(result);
      } catch (error) {
        console.error("[admin-engagement] PUT settings 失敗:", error);
        res.status(500).json({ error: "儲存設定失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/admin/engagement/channels?fieldId= — 列出通知管道
  // ============================================================================
  app.get("/api/admin/engagement/channels", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string | undefined;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId" });
      }
      const channels = await db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.fieldId, fieldId))
        .orderBy(desc(notificationChannels.createdAt));

      // 隱藏敏感欄位（webhook secrets / API keys 等）
      const sanitized = channels.map((c) => {
        const config = (c.config as Record<string, unknown>) ?? {};
        return {
          ...c,
          config: maskSensitiveConfig(config, c.channelType),
        };
      });

      res.json(sanitized);
    } catch (error) {
      console.error("[admin-engagement] GET channels 失敗:", error);
      res.status(500).json({ error: "取得管道列表失敗" });
    }
  });

  // ============================================================================
  // POST /api/admin/engagement/channels — 建管道
  // ============================================================================
  const createChannelSchema = z.object({
    fieldId: z.string().min(1),
    channelType: z.enum([
      "email",
      "line_notify",
      "line_oa",
      "discord_webhook",
      "social_webhook",
    ]),
    isActive: z.boolean().default(false),
    config: z.record(z.string(), z.unknown()),
  });

  app.post("/api/admin/engagement/channels", requireAdminAuth, async (req, res) => {
    try {
      const parsed = createChannelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.errors[0]?.message ?? "驗證失敗",
        });
      }
      const [created] = await db
        .insert(notificationChannels)
        .values(parsed.data)
        .returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[admin-engagement] POST channel 失敗:", error);
      res.status(500).json({ error: "建立管道失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/admin/engagement/channels/:id — 更新管道
  // ============================================================================
  app.patch(
    "/api/admin/engagement/channels/:id",
    requireAdminAuth,
    async (req, res) => {
      try {
        const id = req.params.id;
        const parsed = createChannelSchema.partial().safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "驗證失敗" });
        }

        const updateValue: Record<string, unknown> = {};
        const data = parsed.data;
        if (data.channelType !== undefined) updateValue.channelType = data.channelType;
        if (data.isActive !== undefined) updateValue.isActive = data.isActive;
        if (data.config !== undefined) updateValue.config = data.config;
        updateValue.updatedAt = new Date();

        const [updated] = await db
          .update(notificationChannels)
          .set(updateValue)
          .where(eq(notificationChannels.id, id))
          .returning();

        if (!updated) return res.status(404).json({ error: "管道不存在" });
        res.json(updated);
      } catch (error) {
        console.error("[admin-engagement] PATCH channel 失敗:", error);
        res.status(500).json({ error: "更新管道失敗" });
      }
    },
  );

  // ============================================================================
  // DELETE /api/admin/engagement/channels/:id — 軟刪除（isActive=false）
  // ============================================================================
  app.delete(
    "/api/admin/engagement/channels/:id",
    requireAdminAuth,
    async (req, res) => {
      try {
        const id = req.params.id;
        const [updated] = await db
          .update(notificationChannels)
          .set({ isActive: false })
          .where(eq(notificationChannels.id, id))
          .returning();

        if (!updated) return res.status(404).json({ error: "管道不存在" });
        res.json({ success: true });
      } catch (error) {
        console.error("[admin-engagement] DELETE channel 失敗:", error);
        res.status(500).json({ error: "刪除管道失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/admin/engagement/super-leaders/:fieldId — 取得超級隊長清單（含候選）
  // ============================================================================
  app.get(
    "/api/admin/engagement/super-leaders/:fieldId",
    requireAdminAuth,
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;

        const [settings] = await db
          .select()
          .from(fieldEngagementSettings)
          .where(eq(fieldEngagementSettings.fieldId, fieldId));

        // 取所有 squads（top 100 看夠用）
        const allSquads = await db
          .select()
          .from(squadStats)
          .orderBy(desc(squadStats.totalGames))
          .limit(100);

        const config = {
          minGames: settings?.superLeaderMinGames ?? 100,
          minRecruits: settings?.superLeaderMinRecruits ?? 10,
          minFields: settings?.superLeaderMinFields ?? 2,
          minWinRate: settings?.superLeaderMinWinRate ?? 50,
          autoEnabled: settings?.superLeaderAutoEnabled ?? true,
          manualIds: ((settings?.superLeaderManualIds as string[]) ?? []),
        };

        const { isSuperLeader } = await import(
          "../services/engagement-calculator"
        );

        const result = allSquads.map((s) => {
          const profile = {
            squadId: s.squadId,
            totalGames: s.totalGames,
            totalWins: s.totalWins,
            totalLosses: s.totalLosses,
            recruitsCount: s.recruitsCount,
            fieldsPlayed: (s.fieldsPlayed as string[]) ?? [],
            lastActiveAt: s.lastActiveAt,
          };
          const isSuper = isSuperLeader(profile, config);
          const totalDecisive = s.totalWins + s.totalLosses;
          const winRate =
            totalDecisive > 0 ? Math.round((s.totalWins / totalDecisive) * 100) : 0;

          return {
            ...s,
            isSuperLeader: isSuper,
            isManual: config.manualIds.includes(s.squadId),
            winRate,
            // 距離超級隊長還差多少（分項顯示）
            gapToSuper: isSuper
              ? null
              : {
                  gamesGap: Math.max(0, config.minGames - s.totalGames),
                  recruitsGap: Math.max(0, config.minRecruits - s.recruitsCount),
                  fieldsGap: Math.max(0, config.minFields - profile.fieldsPlayed.length),
                  winRateGap: Math.max(0, config.minWinRate - winRate),
                },
          };
        });

        // 排序：超級隊長 → 場次降序
        result.sort((a, b) => {
          if (a.isSuperLeader !== b.isSuperLeader) {
            return a.isSuperLeader ? -1 : 1;
          }
          return b.totalGames - a.totalGames;
        });

        res.json({
          settings: config,
          superLeaderCount: result.filter((r) => r.isSuperLeader).length,
          totalSquads: result.length,
          squads: result,
        });
      } catch (error) {
        console.error("[admin-engagement] GET super-leaders 失敗:", error);
        res.status(500).json({ error: "取得超級隊長清單失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/admin/engagement/welcome-squads/:fieldId — 預覽歡迎隊伍清單
  // ============================================================================
  app.get(
    "/api/admin/engagement/welcome-squads/:fieldId",
    requireAdminAuth,
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;

        // 取設定
        const [settings] = await db
          .select()
          .from(fieldEngagementSettings)
          .where(eq(fieldEngagementSettings.fieldId, fieldId));

        // 取所有隊伍 stats（簡化：取 top 50 看夠用）
        const allSquads = await db
          .select()
          .from(squadStats)
          .orderBy(desc(squadStats.totalGames))
          .limit(50);

        const config = settings ?? {
          welcomeMode: "auto" as const,
          welcomeAutoTopN: 5,
          welcomeAutoCriteria: "total_games" as const,
          welcomeManualIds: [],
        };

        const { selectWelcomeSquads } = await import(
          "../services/engagement-calculator"
        );

        const result = selectWelcomeSquads(
          allSquads.map((s) => ({
            squadId: s.squadId,
            totalGames: s.totalGames,
            totalWins: s.totalWins,
            totalLosses: s.totalLosses,
            recruitsCount: s.recruitsCount,
            fieldsPlayed: (s.fieldsPlayed as string[]) ?? [],
            lastActiveAt: s.lastActiveAt,
            rating: undefined, // 之後可從 squad_ratings 連結
          })),
          {
            mode: config.welcomeMode as "auto" | "manual" | "hybrid",
            autoTopN: config.welcomeAutoTopN ?? 5,
            autoCriteria: (config.welcomeAutoCriteria ?? "total_games") as
              | "total_games"
              | "rating"
              | "recent_active",
            manualIds: (config.welcomeManualIds as string[]) ?? [],
          },
        );

        res.json({
          settings: config,
          welcomeSquads: result,
        });
      } catch (error) {
        console.error("[admin-engagement] GET welcome-squads 失敗:", error);
        res.status(500).json({ error: "取得歡迎隊伍失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/engagement/run-achievements — 手動觸發成就計算（管理員）
  // ============================================================================
  app.post(
    "/api/admin/engagement/run-achievements",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const { runAchievementsCycle } = await import(
          "../services/achievement-scheduler"
        );
        const result = await runAchievementsCycle();
        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("[admin-engagement] run-achievements 失敗:", error);
        res.status(500).json({ error: "成就計算失敗" });
      }
    },
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** 隱藏敏感設定欄位（不回傳給前端 secret 完整值）*/
function maskSensitiveConfig(
  config: Record<string, unknown>,
  channelType: string,
): Record<string, unknown> {
  const result = { ...config };
  const sensitiveKeys: Record<string, string[]> = {
    line_notify: ["token"],
    line_oa: ["channelAccessToken", "channelSecret"],
    discord_webhook: ["url"],
    social_webhook: ["url", "headers"],
    email: ["smtpPassword", "apiKey"],
  };
  const keys = sensitiveKeys[channelType] ?? [];
  for (const key of keys) {
    if (typeof result[key] === "string" && (result[key] as string).length > 0) {
      const v = result[key] as string;
      result[key] = v.length > 8 ? `${v.slice(0, 4)}***${v.slice(-2)}` : "***";
    }
  }
  return result;
}
