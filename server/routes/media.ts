import type { Express } from "express";
import type { AuthenticatedRequest } from "./types";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import {
  requireAdminAuth,
  requirePermission,
} from "../adminAuth";
import { cloudinaryService } from "../cloudinary";
import { db } from "../db";
import { games, fields, parseFieldSettings } from "@shared/schema";
import type { FieldSettings } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  buildCompositeUrl,
  validateCompositionConfig,
  estimateUrlLength,
  DEFAULT_COMPOSITION_CONFIG,
  ACHIEVEMENT_COMPOSITION_CONFIG,
  todayDateString,
  type CompositionConfig,
  type DynamicVars,
} from "../services/photo-composer";

export function registerMediaRoutes(app: Express) {
  // ===========================================
  // Cloudinary Photo Upload Routes
  // ===========================================

  app.get("/api/cloudinary/status", requireAdminAuth, async (req, res) => {
    try {
      const status = cloudinaryService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to check Cloudinary status" });
    }
  });

  /**
   * 🆕 v2: Cloudinary 用量統計（管理員儀表板用）
   * 回傳本月使用量 + 限額 + 百分比
   */
  app.get("/api/cloudinary/usage", requireAdminAuth, async (req, res) => {
    try {
      const usage = await cloudinaryService.getUsage();
      res.json(usage);
    } catch (error) {
      console.error("[media] /api/cloudinary/usage 失敗:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "取得用量失敗",
      });
    }
  });

  const cloudinaryUploadSchema = z.object({
    imageData: z.string()
      .min(1, "缺少圖片資料")
      .refine(
        (data) => data.startsWith("data:image/") || data.startsWith("data:application/octet-stream"),
        "無效的圖片格式"
      )
      .refine(
        (data) => data.length < 10 * 1024 * 1024,
        "圖片大小不能超過 10MB"
      ),
    gameId: z.string().min(1, "缺少遊戲 ID"),
    sessionId: z.union([z.string(), z.number()]).optional(),
  });

  app.post("/api/cloudinary/upload", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = cloudinaryUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "驗證失敗" });
      }

      const { imageData, gameId, sessionId } = parsed.data;

      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: "遊戲不存在" });
      }

      const result = await cloudinaryService.uploadGamePhoto(
        imageData,
        gameId,
        sessionId ? parseInt(String(sessionId)) : undefined
      );

      res.status(201).json({
        message: "Photo uploaded successfully",
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      });
    } catch (error) {
      console.error("[media] cloudinary/upload 失敗:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "上傳失敗",
      });
    }
  });

  const cloudinaryCoverSchema = z.object({
    imageData: z.string()
      .min(1, "缺少圖片資料")
      .refine(
        (data) => data.startsWith("data:image/") || data.startsWith("data:application/octet-stream"),
        "無效的圖片格式"
      )
      .refine(
        (data) => data.length < 10 * 1024 * 1024,
        "圖片大小不能超過 10MB"
      ),
  });

  app.post("/api/admin/games/:id/cloudinary-cover", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const parsed = cloudinaryCoverSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "驗證失敗" });
      }

      const { imageData } = parsed.data;

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限修改此遊戲" });
      }

      const result = await cloudinaryService.uploadGameCover(imageData, req.params.id);

      const updatedGame = await db
        .update(games)
        .set({ coverImageUrl: result.secure_url })
        .where(eq(games.id, req.params.id))
        .returning();

      res.json({
        message: "封面圖片已更新",
        coverImageUrl: result.secure_url,
        game: updatedGame[0],
      });
    } catch (error) {
      console.error("[media] cloudinary-cover 失敗:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "上傳封面圖片失敗",
      });
    }
  });

  // ============================================================================
  // 🎨 場域視覺資源上傳（Phase 2）
  // ============================================================================

  /** 共用：上傳場域圖片並寫回 fields.settings.theme */
  async function uploadFieldImageAndSaveTheme(opts: {
    fieldId: string;
    imageData: string;
    kind: "cover" | "logo";
  }): Promise<{ url: string }> {
    const field = await db.query.fields.findFirst({
      where: eq(fields.id, opts.fieldId),
    });
    if (!field) throw new Error("場域不存在");

    const result =
      opts.kind === "cover"
        ? await cloudinaryService.uploadFieldCover(opts.imageData, opts.fieldId)
        : await cloudinaryService.uploadFieldLogo(opts.imageData, opts.fieldId);

    const settings: FieldSettings = parseFieldSettings(field.settings);
    const updatedTheme = {
      ...(settings.theme || {}),
      [opts.kind === "cover" ? "coverImageUrl" : "brandingLogoUrl"]:
        result.secure_url,
    };

    await db
      .update(fields)
      .set({
        settings: { ...settings, theme: updatedTheme },
        updatedAt: new Date(),
      })
      .where(eq(fields.id, opts.fieldId));

    return { url: result.secure_url };
  }

  /** 📸 POST /api/admin/fields/:id/cloudinary-cover — 上傳場域封面 */
  app.post(
    "/api/admin/fields/:id/cloudinary-cover",
    requireAdminAuth,
    requirePermission("field:manage"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        if (
          req.admin.systemRole !== "super_admin" &&
          req.params.id !== req.admin.fieldId
        ) {
          return res.status(403).json({ message: "無權修改此場域" });
        }

        const parsed = cloudinaryCoverSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.errors[0]?.message || "驗證失敗",
          });
        }

        const { url } = await uploadFieldImageAndSaveTheme({
          fieldId: req.params.id,
          imageData: parsed.data.imageData,
          kind: "cover",
        });
        res.json({ message: "場域封面已更新", url, kind: "cover" });
      } catch (error) {
        console.error("[media] field cover 上傳失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "上傳場域封面失敗",
        });
      }
    },
  );

  /** 📸 POST /api/admin/fields/:id/cloudinary-logo — 上傳場域 Logo */
  app.post(
    "/api/admin/fields/:id/cloudinary-logo",
    requireAdminAuth,
    requirePermission("field:manage"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        if (
          req.admin.systemRole !== "super_admin" &&
          req.params.id !== req.admin.fieldId
        ) {
          return res.status(403).json({ message: "無權修改此場域" });
        }

        const parsed = cloudinaryCoverSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.errors[0]?.message || "驗證失敗",
          });
        }

        const { url } = await uploadFieldImageAndSaveTheme({
          fieldId: req.params.id,
          imageData: parsed.data.imageData,
          kind: "logo",
        });
        res.json({ message: "場域 Logo 已更新", url, kind: "logo" });
      } catch (error) {
        console.error("[media] field logo 上傳失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "上傳場域 Logo 失敗",
        });
      }
    },
  );

  // 大小上限：15MB base64 字串（約 11MB 原始圖片），防止大圖 OOM / 502
  const MAX_PHOTO_BASE64_SIZE = 15_000_000;

  const playerPhotoSchema = z.object({
    imageData: z.string()
      .min(1, "缺少圖片資料")
      .max(MAX_PHOTO_BASE64_SIZE, "圖片過大（超過 15MB base64 / 約 11MB 原始），請在前端先壓縮")
      .refine(
        (data) => data.startsWith("data:image/"),
        "無效的圖片格式"
      ),
    gameId: z.string().min(1, "缺少遊戲 ID"),
    sessionId: z.string().min(1, "缺少 Session ID"),
  });

  /**
   * 🆕 v2: 上傳連拍單張（帶 burst tag）— 給 photo_burst 用
   * 多張上傳完後呼叫 /api/cloudinary/burst-to-gif 合成動畫
   */
  app.post(
    "/api/cloudinary/burst-frame",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = z.object({
          imageData: z.string().min(1),
          gameId: z.string().min(1),
          sessionId: z.string().min(1),
          tag: z.string().min(1).regex(/^burst_[a-zA-Z0-9_-]+$/, "tag 格式錯誤"),
        }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message });
        }
        const result = await cloudinaryService.uploadImageWithTag(
          parsed.data.imageData,
          parsed.data.gameId,
          parsed.data.sessionId,
          parsed.data.tag,
        );
        res.status(201).json({
          url: result.secure_url,
          publicId: result.public_id,
        });
      } catch (error) {
        console.error("[media] burst-frame 上傳失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "上傳失敗",
        });
      }
    }
  );

  /**
   * 🆕 v2: 合成 GIF/WebP/MP4 動畫（從 tag 抓多張）
   */
  app.post(
    "/api/cloudinary/burst-to-gif",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = z.object({
          tag: z.string().min(1).regex(/^burst_[a-zA-Z0-9_-]+$/),
          format: z.enum(["gif", "webp", "mp4"]).optional(),
          delayMs: z.number().min(100).max(3000).optional(),
        }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.errors[0]?.message });
        }
        const result = await cloudinaryService.createAnimatedFromTag(
          parsed.data.tag,
          parsed.data.format ?? "gif",
          parsed.data.delayMs ?? 500,
        );
        res.json({
          success: true,
          url: result.url,
          publicId: result.publicId,
          format: parsed.data.format ?? "gif",
        });
      } catch (error) {
        console.error("[media] burst-to-gif 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "GIF 合成失敗",
        });
      }
    }
  );

  app.post("/api/cloudinary/player-photo", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = playerPhotoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "驗證失敗" });
      }

      const { imageData, gameId, sessionId } = parsed.data;

      const result = await cloudinaryService.uploadPlayerPhoto(imageData, gameId, sessionId);

      res.status(201).json({
        message: "照片上傳成功",
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (error) {
      console.error("[media] player-photo 上傳失敗:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "上傳失敗",
      });
    }
  });

  // 🛡️ 媒體上傳大小上限（base64 encoded；實際原始檔大小約 = base64.length * 3/4）
  // 估算：50MB base64 ≈ 37MB 原始影片；30MB base64 ≈ 22MB 音訊
  const MAX_MEDIA_BASE64_SIZE: Record<"image" | "video" | "audio", number> = {
    image: 15_000_000, // ~11MB 原始（與 player-photo 一致）
    video: 70_000_000, // ~50MB 原始（短影片教學用）
    audio: 40_000_000, // ~30MB 原始（音訊任務）
  };

  const MEDIA_MIME_PREFIX: Record<"image" | "video" | "audio", string> = {
    image: "data:image/",
    video: "data:video/",
    audio: "data:audio/",
  };

  const gameMediaSchema = z.object({
    mediaData: z.string().min(1, "缺少媒體資料"),
    mediaType: z.enum(["image", "video", "audio"]),
    gameId: z.string().min(1, "缺少遊戲 ID"),
  }).superRefine((val, ctx) => {
    // MIME 驗證：前端可能偽造；server 端必須自己檢查 data: URI prefix
    const expectedPrefix = MEDIA_MIME_PREFIX[val.mediaType];
    if (!val.mediaData.startsWith(expectedPrefix)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaData"],
        message: `mediaType=${val.mediaType} 應以 ${expectedPrefix} 開頭，實際收到 ${val.mediaData.substring(0, 30)}...`,
      });
    }
    // 大小驗證
    const maxSize = MAX_MEDIA_BASE64_SIZE[val.mediaType];
    if (val.mediaData.length > maxSize) {
      const sizeMB = Math.round(val.mediaData.length / 1024 / 1024);
      const maxMB = Math.round(maxSize / 1024 / 1024);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaData"],
        message: `${val.mediaType} 檔案過大（${sizeMB}MB），上限 ${maxMB}MB（base64）`,
      });
    }
  });

  app.post("/api/admin/games/:id/cloudinary-media", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const parsed = gameMediaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "驗證失敗" });
      }

      const { mediaData, mediaType, gameId } = parsed.data;

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限修改此遊戲" });
      }

      const result = await cloudinaryService.uploadGameMedia(mediaData, gameId, mediaType);

      res.json({
        message: `${mediaType === 'image' ? '圖片' : mediaType === 'video' ? '影片' : '音訊'}上傳成功`,
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        duration: result.duration,
      });
    } catch (error) {
      console.error("[media] cloudinary-media 失敗:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "上傳媒體失敗",
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 🎨 紀念照合成 API（v2 — 2026-04-24 新增）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 合成紀念照 — 接受玩家照片 publicId + 模板設定 + 動態變數
   * 回傳 Cloudinary transformation URL（即時生成，無需 webhook）
   *
   * 使用場景：
   *   - photo_spot / photo_compare 驗證成功後合成紀念照
   *   - achievement_card 遊戲完成時生成成就卡
   *   - team_photo 全員上傳後合成九宮格
   */
  const compositePhotoSchema = z.object({
    // 二選一（至少給一個）
    playerPhotoPublicId: z.string().optional(),
    playerPhotoUrl: z.string().url().optional(),
    config: z.custom<CompositionConfig>((v) => !!v, {
      message: "缺少 composition config",
    }),
    dynamicVars: z.record(z.string(), z.union([z.string(), z.number(), z.undefined()])).optional(),
  }).refine(
    (v) => v.playerPhotoPublicId || v.playerPhotoUrl,
    { message: "playerPhotoPublicId 或 playerPhotoUrl 至少需提供一個" },
  );

  app.post(
    "/api/cloudinary/composite-photo",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = compositePhotoSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.errors[0]?.message || "參數錯誤",
          });
        }

        const { playerPhotoPublicId, playerPhotoUrl, config, dynamicVars } = parsed.data;

        // 驗證 config 合法性
        const [isValid, errors] = validateCompositionConfig(config);
        if (!isValid) {
          return res.status(400).json({
            error: "合成設定無效",
            details: errors,
          });
        }

        // 注入預設日期（若 dynamicVars 沒給）
        const vars: DynamicVars = {
          date: todayDateString(),
          ...dynamicVars,
        };

        const compositeUrl = buildCompositeUrl({
          playerPhotoPublicId,
          playerPhotoUrl,
          config,
          dynamicVars: vars,
        });

        const urlLength = estimateUrlLength({
          playerPhotoPublicId,
          playerPhotoUrl,
          config,
          dynamicVars: vars,
        });

        // URL 太長警告（Cloudinary 限制約 1500 字元）
        if (urlLength > 1400) {
          console.warn(
            `[composite-photo] URL 長度 ${urlLength} 接近上限，建議改用 named transformation`
          );
        }

        res.json({
          success: true,
          compositeUrl,
          urlLength,
        });
      } catch (error) {
        console.error("[media] composite-photo 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "合成失敗",
        });
      }
    }
  );

  /**
   * 合成預覽 — 管理員端：用測試圖預覽模板效果
   * 不需 authenticated 玩家 session，但需 admin
   */
  const compositePreviewSchema = z.object({
    config: z.custom<CompositionConfig>((v) => !!v, { message: "缺少 config" }),
    testPhotoPublicId: z.string().optional(),  // 預設用系統測試圖
    dynamicVars: z.record(z.string(), z.union([z.string(), z.number(), z.undefined()])).optional(),
  });

  // 系統內建測試圖（Cloudinary 免費提供）
  const DEFAULT_TEST_PHOTO = "samples/people/smiling-man";

  app.post(
    "/api/admin/photo-composite/preview",
    requireAdminAuth,
    async (req, res) => {
      try {
        const parsed = compositePreviewSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.errors[0]?.message || "參數錯誤",
          });
        }

        const { config, testPhotoPublicId, dynamicVars } = parsed.data;

        const [isValid, errors] = validateCompositionConfig(config);
        if (!isValid) {
          return res.status(400).json({
            error: "合成設定無效",
            details: errors,
          });
        }

        const vars: DynamicVars = {
          date: todayDateString(),
          gameTitle: "示範遊戲",
          fieldName: "示範場域",
          playerName: "示範玩家",
          score: 100,
          ...dynamicVars,
        };

        const compositeUrl = buildCompositeUrl({
          playerPhotoPublicId: testPhotoPublicId || DEFAULT_TEST_PHOTO,
          config,
          dynamicVars: vars,
        });

        res.json({
          success: true,
          compositeUrl,
          urlLength: compositeUrl.length,
        });
      } catch (error) {
        console.error("[media] composite-preview 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "預覽失敗",
        });
      }
    }
  );

  /**
   * 取得預設合成模板（系統內建）
   */
  app.get("/api/photo-composite/default-config", (_req, res) => {
    res.json({ config: DEFAULT_COMPOSITION_CONFIG });
  });

  /**
   * 🏆 取得成就卡預設模板（系統內建）— GameCompletionScreen 用
   * 🆕 v2: 支援 ?fieldCode=XXX — 該場域有自訂 photoTemplates.achievement 就回覆場域模板
   */
  app.get("/api/photo-composite/achievement-config", async (req, res) => {
    try {
      const fieldCode = (req.query.fieldCode as string | undefined)?.toUpperCase();
      if (fieldCode) {
        const [field] = await db
          .select({ settings: fields.settings })
          .from(fields)
          .where(eq(fields.code, fieldCode))
          .limit(1);
        if (field) {
          const settings = parseFieldSettings(field.settings);
          const custom = settings.photoTemplates?.achievement;
          if (custom?.enabled !== false && custom?.textLayers && custom.textLayers.length > 0) {
            // 場域自訂 → 組出 CompositionConfig
            const config: CompositionConfig = {
              canvas: {
                width: custom.canvas?.width ?? 1080,
                height: custom.canvas?.height ?? 1080,
                crop: custom.canvas?.crop ?? "fill",
                gravity: "auto",
              },
              layers: custom.textLayers.map((t) => ({
                type: "text" as const,
                text: t.text,
                font: "Noto_Sans_TC",
                size: t.size ?? 48,
                weight: t.bold ? ("bold" as const) : ("normal" as const),
                color: t.color ?? "white",
                background: t.background,
                gravity: (t.gravity as any) ?? "south",
                y: t.offsetY ?? 80,
              })),
            };
            return res.json({ config, source: "field", fieldCode });
          }
        }
      }
      // Fallback: 系統預設
      res.json({ config: ACHIEVEMENT_COMPOSITION_CONFIG, source: "system" });
    } catch (error) {
      console.error("[media] achievement-config field lookup 失敗:", error);
      res.json({ config: ACHIEVEMENT_COMPOSITION_CONFIG, source: "system_fallback" });
    }
  });

  /**
   * 🎞 取得場域紀念照模板（photo_spot / photo_compare 用）
   * 支援 ?fieldCode=XXX，有場域自訂就用，沒則回系統 DEFAULT_COMPOSITION_CONFIG
   */
  app.get("/api/photo-composite/memorial-config", async (req, res) => {
    try {
      const fieldCode = (req.query.fieldCode as string | undefined)?.toUpperCase();
      if (fieldCode) {
        const [field] = await db
          .select({ settings: fields.settings })
          .from(fields)
          .where(eq(fields.code, fieldCode))
          .limit(1);
        if (field) {
          const settings = parseFieldSettings(field.settings);
          const custom = settings.photoTemplates?.memorial;
          if (custom?.enabled !== false && custom?.textLayers && custom.textLayers.length > 0) {
            const config: CompositionConfig = {
              canvas: {
                width: custom.canvas?.width ?? 1080,
                height: custom.canvas?.height ?? 1080,
                crop: custom.canvas?.crop ?? "fill",
                gravity: "auto",
              },
              layers: custom.textLayers.map((t) => ({
                type: "text" as const,
                text: t.text,
                font: "Noto_Sans_TC",
                size: t.size ?? 36,
                weight: t.bold ? ("bold" as const) : ("normal" as const),
                color: t.color ?? "white",
                background: t.background,
                gravity: (t.gravity as any) ?? "south",
                y: t.offsetY ?? 40,
              })),
            };
            return res.json({ config, source: "field", fieldCode });
          }
        }
      }
      res.json({ config: DEFAULT_COMPOSITION_CONFIG, source: "system" });
    } catch (error) {
      console.error("[media] memorial-config field lookup 失敗:", error);
      res.json({ config: DEFAULT_COMPOSITION_CONFIG, source: "system_fallback" });
    }
  });

  /**
   * 📸 v2: 我的所有照片（個人相簿）
   * 取得當前登入使用者在所有 session 的照片聚合
   */
  app.get(
    "/api/me/photos",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub || req.user?.dbUser?.id;
        if (!userId) {
          return res.status(401).json({ error: "未認證" });
        }

        // 取使用者所有 session IDs
        const userSessions = await storage.getSessionsByUser(userId);
        const sessionIds = userSessions.map((s) => s.session.id);

        if (sessionIds.length === 0) {
          return res.json({ photos: [], total: 0 });
        }

        const photos = await cloudinaryService.listUserPhotos(sessionIds);

        // 反向對應 session meta（加入遊戲名、時間方便前端顯示）
        const sessionMap = new Map(
          userSessions.map((s) => [
            s.session.id,
            {
              gameId: s.session.gameId,
              startedAt: s.session.startedAt,
              teamName: s.session.teamName,
            },
          ])
        );

        const photosWithMeta = photos.map((p) => ({
          ...p,
          gameId: sessionMap.get(p.sessionId)?.gameId ?? null,
          teamName: sessionMap.get(p.sessionId)?.teamName ?? null,
          startedAt: sessionMap.get(p.sessionId)?.startedAt ?? null,
        }));

        res.json({
          photos: photosWithMeta,
          total: photosWithMeta.length,
        });
      } catch (error) {
        console.error("[media] /api/me/photos 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "取得個人相簿失敗",
        });
      }
    }
  );

  /**
   * 📦 v2: Session 相簿 ZIP 下載 URL（Cloudinary archive API）
   * 回傳 signed URL，前端直接導連下載整包 zip（比批次下載 UX 好）
   */
  app.get(
    "/api/sessions/:sessionId/album/zip-url",
    async (req: AuthenticatedRequest, res) => {
      try {
        const { sessionId } = req.params;
        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: "Session 不存在" });
        }
        if (!session.gameId) {
          return res.status(400).json({ error: "Session 缺少 gameId" });
        }

        const url = await cloudinaryService.createSessionArchiveUrl(
          session.gameId,
          sessionId,
        );
        if (!url) {
          return res.status(404).json({ error: "沒有照片可下載" });
        }

        res.json({ url, sessionId });
      } catch (error) {
        console.error("[media] zip-url 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "產生 ZIP 失敗",
        });
      }
    }
  );

  /**
   * 📦 v2: 個人相簿 ZIP 下載 URL（跨所有 session）
   */
  app.get(
    "/api/me/photos/zip-url",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub || req.user?.dbUser?.id;
        if (!userId) return res.status(401).json({ error: "未認證" });

        const userSessions = await storage.getSessionsByUser(userId);
        const sessionIds = userSessions.map((s) => s.session.id);
        if (sessionIds.length === 0) {
          return res.status(404).json({ error: "沒有可下載的照片" });
        }

        const url = await cloudinaryService.createUserArchiveUrl(sessionIds);
        if (!url) {
          return res.status(404).json({ error: "沒有照片可下載" });
        }

        res.json({ url });
      } catch (error) {
        console.error("[media] me/photos/zip-url 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "產生 ZIP 失敗",
        });
      }
    }
  );

  /**
   * 📸 v2: Session 相簿 — 列出該 session 所有玩家照片
   * 玩家可開 /album/:sessionId 查看自己本次遊戲的照片
   */
  app.get(
    "/api/sessions/:sessionId/album",
    async (req: AuthenticatedRequest, res) => {
      try {
        const { sessionId } = req.params;

        // 取 session 的 gameId（照片 folder 需要 gameId + sessionId）
        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ error: "Session 不存在" });
        }
        if (!session.gameId) {
          return res.status(400).json({ error: "Session 缺少 gameId" });
        }

        const photos = await cloudinaryService.listSessionPhotos(
          session.gameId,
          sessionId,
        );

        res.json({
          sessionId,
          gameId: session.gameId,
          playerName: session.playerName ?? null,
          teamName: session.teamName ?? null,
          startedAt: session.startedAt ?? null,
          completedAt: session.completedAt ?? null,
          score: session.score ?? 0,
          photos,
        });
      } catch (error) {
        console.error("[media] session album 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "取得相簿失敗",
        });
      }
    }
  );
}
