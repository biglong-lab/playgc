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

  /** 共用：把圖片上傳到場域主題的 cover/logo，並寫回 fields.settings.theme */
  async function updateFieldImageAsset(
    req: Parameters<Parameters<typeof app.post>[2]>[0],
    res: Parameters<Parameters<typeof app.post>[2]>[1],
    kind: "cover" | "logo",
  ) {
    if (!req.admin) return res.status(401).json({ message: "未認證" });

    // 權限：super_admin 或同場域
    if (
      req.admin.systemRole !== "super_admin" &&
      req.params.id !== req.admin.fieldId
    ) {
      return res.status(403).json({ message: "無權修改此場域" });
    }

    const parsed = cloudinaryCoverSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "驗證失敗" });
    }

    const field = await db.query.fields.findFirst({
      where: eq(fields.id, req.params.id),
    });
    if (!field) return res.status(404).json({ message: "場域不存在" });

    const result =
      kind === "cover"
        ? await cloudinaryService.uploadFieldCover(
            parsed.data.imageData,
            req.params.id,
          )
        : await cloudinaryService.uploadFieldLogo(
            parsed.data.imageData,
            req.params.id,
          );

    // 回寫 settings.theme
    const settings: FieldSettings = parseFieldSettings(field.settings);
    const updatedTheme = {
      ...(settings.theme || {}),
      [kind === "cover" ? "coverImageUrl" : "brandingLogoUrl"]: result.secure_url,
    };

    await db
      .update(fields)
      .set({
        settings: { ...settings, theme: updatedTheme },
        updatedAt: new Date(),
      })
      .where(eq(fields.id, req.params.id));

    return res.json({
      message: kind === "cover" ? "場域封面已更新" : "場域 Logo 已更新",
      url: result.secure_url,
      kind,
    });
  }

  /** 📸 POST /api/admin/fields/:id/cloudinary-cover — 上傳場域封面 */
  app.post(
    "/api/admin/fields/:id/cloudinary-cover",
    requireAdminAuth,
    requirePermission("field:manage"),
    async (req, res) => {
      try {
        await updateFieldImageAsset(req, res, "cover");
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
        await updateFieldImageAsset(req, res, "logo");
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
}
