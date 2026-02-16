import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
import { generateGameQRCode, generateSlug } from "../qrCodeService";
import { getAllModules, getModuleById, pages } from "@shared/schema";
import { db } from "../db";
import { games, insertGameSchema } from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";

// 從模組建立遊戲的請求 schema
const createFromModuleSchema = z.object({
  title: z.string().min(1, "遊戲名稱為必填").max(200),
  fieldId: z.string().optional(),
});

export function registerAdminModuleRoutes(app: Express) {
  // ============================================================================
  // Game Module Library Routes - 遊戲模組庫
  // ============================================================================

  // 取得所有遊戲模組
  app.get("/api/admin/modules", requireAdminAuth, async (_req, res) => {
    try {
      const modules = getAllModules();
      res.json(modules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch modules" });
    }
  });

  // 取得單一遊戲模組詳情
  app.get("/api/admin/modules/:id", requireAdminAuth, async (req, res) => {
    try {
      const moduleData = getModuleById(req.params.id);
      if (!moduleData) {
        return res.status(404).json({ message: "模組不存在" });
      }
      res.json(moduleData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch module" });
    }
  });

  // 從模組建立遊戲
  app.post(
    "/api/admin/modules/:id/create-game",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ message: "未認證" });
        }

        // 驗證模組存在
        const moduleData = getModuleById(req.params.id);
        if (!moduleData) {
          return res.status(404).json({ message: "模組不存在" });
        }

        // 驗證請求資料
        const parseResult = createFromModuleSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            message: "資料格式錯誤",
            errors: parseResult.error.errors,
          });
        }

        const { title } = parseResult.data;
        const fieldId =
          req.admin.systemRole === "super_admin"
            ? parseResult.data.fieldId || req.admin.fieldId
            : req.admin.fieldId;

        const slug = generateSlug();

        // 建立遊戲
        const [game] = await db
          .insert(games)
          .values({
            title,
            fieldId,
            publicSlug: slug,
            creatorId: null,
            difficulty: moduleData.difficulty,
            estimatedTime: moduleData.estimatedTime,
            maxPlayers: moduleData.maxPlayers,
          })
          .returning();

        // 自動建立模組預設頁面
        if (moduleData.pages.length > 0) {
          for (let i = 0; i < moduleData.pages.length; i++) {
            const templatePage = moduleData.pages[i];
            await db.insert(pages).values({
              id: randomUUID(),
              gameId: game.id,
              pageType: templatePage.pageType,
              pageOrder: i + 1,
              config: templatePage.config,
            });
          }
        }

        // 產生 QR Code
        const qrCodeDataUrl = await generateGameQRCode(game.id);

        // 記錄審計日誌
        await logAuditAction({
          actorAdminId: req.admin.id,
          action: "game:create",
          targetType: "game",
          targetId: game.id,
          fieldId,
          metadata: {
            title,
            moduleId: moduleData.id,
            moduleName: moduleData.name,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json({ ...game, qrCodeUrl: qrCodeDataUrl });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料格式錯誤", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create game from module" });
      }
    }
  );
}
