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
import { insertGameSchema, getTemplateById, pages, fields, parseFieldSettings } from "@shared/schema";
import { db } from "../db";
import { games } from "@shared/schema";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { randomUUID } from "crypto";

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

      // 從請求中取得 templateId（可選）
      const { templateId, ...gameData } = req.body;
      const data = insertGameSchema.parse(gameData);

      // 如果有 templateId，取得模板配置
      const template = templateId ? getTemplateById(templateId) : null;

      const fieldId = req.admin.systemRole === "super_admin"
        ? (data.fieldId || req.admin.fieldId)
        : req.admin.fieldId;

      // 配額檢查：場域最大遊戲數
      if (fieldId) {
        const [field] = await db.select({ settings: fields.settings })
          .from(fields)
          .where(eq(fields.id, fieldId))
          .limit(1);

        if (field) {
          const settings = parseFieldSettings(field.settings);
          if (settings.maxGames && settings.maxGames > 0) {
            const [{ value: currentCount }] = await db.select({ value: count() })
              .from(games)
              .where(eq(games.fieldId, fieldId));

            if (currentCount >= settings.maxGames) {
              return res.status(403).json({
                message: `此場域已達遊戲數上限（${settings.maxGames}），請聯繫管理員調整配額`,
              });
            }
          }
        }
      }

      const slug = generateSlug();

      // 如果使用模板，套用模板的預設值
      const gameValues = {
        ...data,
        fieldId,
        publicSlug: slug,
        creatorId: null,
        // 從模板套用預設值（如果有）
        ...(template && {
          difficulty: data.difficulty || template.difficulty,
          estimatedTime: data.estimatedTime ?? template.estimatedTime,
          maxPlayers: data.maxPlayers || template.maxPlayers,
        }),
      };

      const [game] = await db.insert(games).values(gameValues).returning();

      // 如果使用模板且有預設頁面，自動建立頁面
      if (template && template.pages.length > 0) {
        for (let i = 0; i < template.pages.length; i++) {
          const templatePage = template.pages[i];
          await db.insert(pages).values({
            id: randomUUID(),
            gameId: game.id,
            pageType: templatePage.pageType,
            pageOrder: i + 1,
            config: templatePage.config,
          });
        }
      }

      const qrCodeDataUrl = await generateGameQRCode(game.id);

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "game:create",
        targetType: "game",
        targetId: game.id,
        fieldId,
        metadata: { title: data.title, templateId: templateId || null },
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

  // 遊戲更新 Schema - 明確列出允許更新的欄位，防止 mass assignment 攻擊
  const updateGameSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    estimatedTime: z.number().int().positive().nullable().optional(),
    maxPlayers: z.number().int().min(1).max(100).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    // 位置鎖定設定
    locationLockEnabled: z.boolean().optional(),
    lockLatitude: z.string().nullable().optional(),
    lockLongitude: z.string().nullable().optional(),
    lockRadius: z.number().int().positive().nullable().optional(),
    lockLocationName: z.string().max(200).nullable().optional(),
    // 團隊模式設定
    gameMode: z.enum(["individual", "team"]).optional(),
    minTeamPlayers: z.number().int().min(1).optional(),
    maxTeamPlayers: z.number().int().min(1).optional(),
    enableTeamChat: z.boolean().optional(),
    enableTeamVoice: z.boolean().optional(),
    enableTeamLocation: z.boolean().optional(),
    teamScoreMode: z.enum(["shared", "individual", "hybrid"]).optional(),
  }).strict(); // strict() 拒絕未定義的欄位

  app.patch("/api/admin/games/:id", requireAdminAuth, requirePermission("game:edit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      // 驗證並過濾允許更新的欄位
      const parseResult = updateGameSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "資料格式錯誤",
          errors: parseResult.error.errors
        });
      }
      const updateData = parseResult.data;

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
        .set({ ...updateData, updatedAt: new Date() })
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
