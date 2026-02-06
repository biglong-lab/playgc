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
import { games } from "@shared/schema";
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
    } catch (error: any) {
      res.status(500).json({ error: error.message || "上傳失敗" });
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
    } catch (error: any) {
      res.status(500).json({ message: error.message || "上傳封面圖片失敗" });
    }
  });

  const playerPhotoSchema = z.object({
    imageData: z.string()
      .min(1, "缺少圖片資料")
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
    } catch (error: any) {
      res.status(500).json({ error: error.message || "上傳失敗" });
    }
  });

  const gameMediaSchema = z.object({
    mediaData: z.string().min(1, "缺少媒體資料"),
    mediaType: z.enum(["image", "video", "audio"]),
    gameId: z.string().min(1, "缺少遊戲 ID"),
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
    } catch (error: any) {
      res.status(500).json({ message: error.message || "上傳媒體失敗" });
    }
  });
}
