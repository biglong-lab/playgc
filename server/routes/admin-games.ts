import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
// 🆕 C2: 示範遊戲 JSON（esbuild 會把 JSON inline 進 bundle）
import demoGameJiachun from "../../docs/DEMO_GAME_JIACHUN.json";
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
import { eq, desc, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { syncGamesMeter } from "../services/billing";
import { storage } from "../storage";

export function registerAdminGameRoutes(app: Express) {
  // ============================================================================
  // Admin Game Management Routes - 管理員遊戲管理
  // ============================================================================

  app.get("/api/admin/games", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      // 🔒 場域隔離：任何 admin（含 super_admin）只看自己登入場域的遊戲
      //   super_admin 要看其他場域 → 用目前帳號重新登入該場域，或走 /platform 後台
      //   這樣「登入 HPSPACE 就看 HPSPACE」行為一致
      //   孤兒遊戲（fieldId=NULL）現已全部指派場域，不再是考量
      const whereClause = eq(games.fieldId, req.admin.fieldId);

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

  // 🎯 列出 Arduino 裝置清單（給 ShootingMissionEditor 等地方選擇 deviceId 用）
  // 用 admin session 認證（game-editor 是 admin session，不是 Firebase token）
  // 回傳含 deviceId / deviceName / status / batteryLevel，前端能決定是否可用
  app.get(
    "/api/admin/devices",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const devices = await storage.getArduinoDevices();
        res.json(devices);
      } catch (error) {
        console.error("[admin-games] list devices failed:", error);
        res.status(500).json({ message: "無法取得裝置清單" });
      }
    },
  );

  // 🩺 健康檢查：列出無場域孤兒遊戲（僅 super_admin 可見）
  // 目的：讓管理員主動發現 `field_id IS NULL` 的異常資料，避免「前端看得到、後台看不到」情境
  app.get(
    "/api/admin/games/health/orphans",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        if (req.admin.systemRole !== "super_admin") {
          return res.status(403).json({ message: "僅限超級管理員" });
        }

        const orphans = await db.query.games.findMany({
          where: sql`${games.fieldId} IS NULL`,
          orderBy: [desc(games.createdAt)],
        });

        res.json({
          count: orphans.length,
          orphans: orphans.map((g) => ({
            id: g.id,
            title: g.title,
            status: g.status,
            createdAt: g.createdAt,
          })),
          recommendation: orphans.length > 0
            ? "使用 PATCH /api/admin/games/:id 的 fieldId 欄位把它們指派給適當場域"
            : "無異常",
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to check orphan games" });
      }
    },
  );

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

      // 🔒 新建遊戲一律歸屬登入場域（super_admin 要建其他場域 → 切換場域）
      const fieldId = req.admin.fieldId;

      // 🔒 強制 fieldId：若無法決定場域就 reject，避免產生「後台看不到」的孤兒遊戲
      if (!fieldId) {
        return res.status(400).json({
          message: "無法決定遊戲所屬場域，請先指派管理員場域或在建立時指定 fieldId",
        });
      }

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

      // SaaS 用量同步：games meter（total）
      if (fieldId) {
        syncGamesMeter(fieldId).catch((err) =>
          console.error("[billing] syncGamesMeter 失敗:", err),
        );
      }

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

      // SaaS 用量同步：games meter（total）
      if (existingGame.fieldId) {
        syncGamesMeter(existingGame.fieldId).catch((err) =>
          console.error("[billing] syncGamesMeter 失敗:", err),
        );
      }

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

  // ============================================================================
  // 🆕 C2: POST /api/admin/games/create-from-demo
  //   從 docs/DEMO_GAME_JIACHUN.json 建立示範遊戲
  //   用於 demo / onboarding，管理員一鍵匯入
  // ============================================================================
  app.post(
    "/api/admin/games/create-from-demo",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const fieldId = req.admin.fieldId;
        if (!fieldId) {
          return res
            .status(400)
            .json({ message: "無法決定遊戲所屬場域，請先指派管理員場域" });
        }

        // 讀取 demo JSON（打包進 Docker image 時的 /app/docs/... 或 dev 時的 relative）
        const demoPath = resolve(process.cwd(), "docs/DEMO_GAME_JIACHUN.json");
        let demoData: {
          game: Record<string, unknown>;
          pages: Array<{
            pageOrder: number;
            pageType: string;
            customName?: string;
            config: unknown;
          }>;
        };
        try {
          const raw = await readFile(demoPath, "utf-8");
          demoData = JSON.parse(raw);
        } catch (err) {
          return res.status(500).json({
            message: "無法載入示範遊戲 JSON",
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // 配額檢查
        const [field] = await db
          .select({ settings: fields.settings })
          .from(fields)
          .where(eq(fields.id, fieldId))
          .limit(1);
        if (field) {
          const settings = parseFieldSettings(field.settings);
          if (settings.maxGames && settings.maxGames > 0) {
            const [{ value: currentCount }] = await db
              .select({ value: count() })
              .from(games)
              .where(eq(games.fieldId, fieldId));
            if (currentCount >= settings.maxGames) {
              return res.status(403).json({
                message: `此場域已達遊戲數上限（${settings.maxGames}）`,
              });
            }
          }
        }

        // 建遊戲
        const slug = generateSlug();
        const gameBase = insertGameSchema.parse(demoData.game);
        const [game] = await db
          .insert(games)
          .values({
            ...gameBase,
            fieldId,
            publicSlug: slug,
            creatorId: null,
          })
          .returning();

        // 建所有頁面
        let createdPages = 0;
        for (const p of demoData.pages) {
          await db.insert(pages).values({
            id: randomUUID(),
            gameId: game.id,
            pageOrder: p.pageOrder,
            pageType: p.pageType,
            customName: p.customName || null,
            config: p.config as Record<string, unknown>,
          });
          createdPages += 1;
        }

        // 審計日誌
        await logAuditAction({
          adminId: req.admin.id,
          action: "game:create-from-demo",
          targetType: "game",
          targetId: game.id,
          fieldId,
          metadata: {
            title: game.title,
            pagesCreated: createdPages,
            source: "DEMO_GAME_JIACHUN.json",
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        // 同步計費 meter
        await syncGamesMeter(fieldId).catch(() => {});

        return res.json({
          success: true,
          game,
          pagesCreated: createdPages,
          playerUrl: `/g/${slug}`,
        });
      } catch (error) {
        console.error("[admin-games] create-from-demo failed:", error);
        return res.status(500).json({
          message: "匯入示範遊戲失敗",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
}
