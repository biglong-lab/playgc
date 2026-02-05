import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
import {
  generateGameQRCode,
  generateGameUrl,
  generateSlug,
} from "../qrCodeService";
import {
  ObjectStorageService,
} from "../objectStorage";
import { insertGameSchema } from "@shared/schema";
import { db } from "../db";
import { games } from "@shared/schema";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

export function registerAdminGameRoutes(app: Express) {
  // ============================================================================
  // Admin Game Management Routes - 管理員遊戲管理
  // ============================================================================

  app.get("/api/admin/games", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const whereClause = req.admin.systemRole === "super_admin"
        ? undefined
        : eq(games.fieldId, req.admin.fieldId);

      const gamesList = await db.query.games.findMany({
        where: whereClause,
        with: {
          creator: true,
          field: true,
        },
        orderBy: [desc(games.createdAt)],
      });

      res.json(gamesList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get("/api/admin/games/:id", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
        with: {
          creator: true,
          field: true,
          pages: {
            orderBy: (pages, { asc }) => [asc(pages.pageOrder)],
          },
        },
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限存取此遊戲" });
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.post("/api/admin/games", requireAdminAuth, requirePermission("game:create"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const data = insertGameSchema.parse(req.body);

      const fieldId = req.admin.systemRole === "super_admin"
        ? (data.fieldId || req.admin.fieldId)
        : req.admin.fieldId;

      const slug = generateSlug();

      const [game] = await db.insert(games).values({
        ...data,
        fieldId,
        publicSlug: slug,
        creatorId: null,
      }).returning();

      const qrCodeDataUrl = await generateGameQRCode(game.id);

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "game:create",
        targetType: "game",
        targetId: game.id,
        fieldId,
        metadata: { title: data.title },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({ ...game, qrCodeUrl: qrCodeDataUrl });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "資料格式錯誤", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.patch("/api/admin/games/:id", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const existingGame = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!existingGame) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && existingGame.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限編輯此遊戲" });
      }

      const [updatedGame] = await db.update(games)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(games.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "game:edit",
        targetType: "game",
        targetId: req.params.id,
        fieldId: existingGame.fieldId || undefined,
        metadata: { title: updatedGame.title },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updatedGame);
    } catch (error) {
      res.status(500).json({ message: "Failed to update game" });
    }
  });

  app.delete("/api/admin/games/:id", requireAdminAuth, requirePermission("game:delete"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const existingGame = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!existingGame) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && existingGame.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限刪除此遊戲" });
      }

      await db.delete(games).where(eq(games.id, req.params.id));

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "game:delete",
        targetType: "game",
        targetId: req.params.id,
        fieldId: existingGame.fieldId || undefined,
        metadata: { title: existingGame.title },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete game" });
    }
  });

  app.post("/api/admin/games/:id/publish", requireAdminAuth, requirePermission("game:publish"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { status } = req.body;

      const existingGame = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!existingGame) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && existingGame.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限修改此遊戲狀態" });
      }

      const [updatedGame] = await db.update(games)
        .set({ status, updatedAt: new Date() })
        .where(eq(games.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: status === 'published' ? "game:publish" : "game:unpublish",
        targetType: "game",
        targetId: req.params.id,
        fieldId: existingGame.fieldId || undefined,
        metadata: { title: existingGame.title, status },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updatedGame);
    } catch (error) {
      res.status(500).json({ message: "Failed to update game status" });
    }
  });

  app.post("/api/admin/games/:id/qrcode", requireAdminAuth, requirePermission("qr:generate"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const existingGame = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!existingGame) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && existingGame.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限產生此遊戲的 QR Code" });
      }

      const { regenerateSlug } = req.body;
      let slug = existingGame.publicSlug;

      if (regenerateSlug || !slug) {
        slug = generateSlug();
        await db.update(games).set({ publicSlug: slug }).where(eq(games.id, req.params.id));
      }

      const qrCodeDataUrl = await generateGameQRCode(req.params.id);
      const gameUrl = generateGameUrl(slug!);

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "qr:generate",
        targetType: "game",
        targetId: req.params.id,
        fieldId: existingGame.fieldId || undefined,
        metadata: { title: existingGame.title, slug },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ slug, qrCodeUrl: qrCodeDataUrl, gameUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.get("/api/admin/games/:id/qrcode", requireAdminAuth, requirePermission("qr:view"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限檢視此遊戲的 QR Code" });
      }

      if (!game.publicSlug || !game.qrCodeUrl) {
        return res.status(404).json({ message: "尚未產生 QR Code" });
      }

      res.json({
        slug: game.publicSlug,
        qrCodeUrl: game.qrCodeUrl,
        gameUrl: generateGameUrl(game.publicSlug),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get QR code" });
    }
  });

  // ============================================================================
  // Game Cover Image Upload
  // ============================================================================
  app.post("/api/admin/games/:id/cover-upload-url", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限修改此遊戲" });
      }

      const storageService = new ObjectStorageService();
      const uploadURL = await storageService.getObjectEntityUploadURL();
      const objectPath = storageService.normalizeObjectEntityPath(uploadURL.split("?")[0]);

      res.json({
        uploadURL,
        objectPath,
      });
    } catch (error) {
      res.status(500).json({ message: "無法產生上傳網址" });
    }
  });

  app.post("/api/admin/games/:id/cover", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { objectPath } = req.body;
      if (!objectPath) {
        return res.status(400).json({ message: "缺少圖片路徑" });
      }

      const validPathPattern = /^\/objects\/uploads\/[a-f0-9-]{36}$/i;
      if (!validPathPattern.test(objectPath)) {
        return res.status(400).json({ message: "無效的圖片路徑格式" });
      }

      const game = await db.query.games.findFirst({
        where: eq(games.id, req.params.id),
      });

      if (!game) {
        return res.status(404).json({ message: "遊戲不存在" });
      }

      if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權限修改此遊戲" });
      }

      const storageService = new ObjectStorageService();
      await storageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: req.admin.id,
        visibility: "public",
      });

      const updatedGame = await db
        .update(games)
        .set({ coverImageUrl: objectPath, updatedAt: new Date() })
        .where(eq(games.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "game:edit",
        targetType: "game",
        targetId: req.params.id,
        fieldId: game.fieldId || undefined,
        metadata: { title: game.title, action: "上傳封面圖片" },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updatedGame[0]);
    } catch (error) {
      res.status(500).json({ message: "無法儲存封面圖片" });
    }
  });
}
