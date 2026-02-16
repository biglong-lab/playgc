// 管理端章節路由 - 章節 CRUD、排序、頁面分配
import type { Express } from "express";
import { storage } from "../storage";
import {
  requireAdminAuth,
  requirePermission,
} from "../adminAuth";
import { insertGameChapterSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "../db";
import { pages } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerAdminChapterRoutes(app: Express) {
  // ========================================================================
  // 列出遊戲章節
  // ========================================================================
  app.get(
    "/api/admin/games/:gameId/chapters",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const chapters = await storage.getChapters(gameId);
        res.json(chapters);
      } catch (error) {
        res.status(500).json({ message: "無法取得章節列表" });
      }
    }
  );

  // ========================================================================
  // 建立章節
  // ========================================================================
  app.post(
    "/api/admin/games/:gameId/chapters",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;

        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        // 自動計算排序
        const existing = await storage.getChapters(gameId);
        const nextOrder = existing.length + 1;

        const data = insertGameChapterSchema.parse({
          ...req.body,
          gameId,
          chapterOrder: req.body.chapterOrder ?? nextOrder,
        });

        const chapter = await storage.createChapter(data);
        res.status(201).json(chapter);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "無法建立章節" });
      }
    }
  );

  // ========================================================================
  // 更新章節
  // ========================================================================
  app.patch(
    "/api/admin/chapters/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const chapter = await storage.getChapter(id);
        if (!chapter) {
          return res.status(404).json({ message: "章節不存在" });
        }

        const updated = await storage.updateChapter(id, req.body);
        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "無法更新章節" });
      }
    }
  );

  // ========================================================================
  // 刪除章節
  // ========================================================================
  app.delete(
    "/api/admin/chapters/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const chapter = await storage.getChapter(id);
        if (!chapter) {
          return res.status(404).json({ message: "章節不存在" });
        }

        await storage.deleteChapter(id);
        res.json({ message: "章節已刪除" });
      } catch (error) {
        res.status(500).json({ message: "無法刪除章節" });
      }
    }
  );

  // ========================================================================
  // 重新排序章節
  // ========================================================================
  app.patch(
    "/api/admin/chapters/reorder",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId, chapterIds } = req.body;

        if (!gameId || !Array.isArray(chapterIds)) {
          return res
            .status(400)
            .json({ message: "需要 gameId 和 chapterIds" });
        }

        await storage.reorderChapters(gameId, chapterIds);
        const chapters = await storage.getChapters(gameId);
        res.json(chapters);
      } catch (error) {
        res.status(500).json({ message: "無法重新排序" });
      }
    }
  );

  // ========================================================================
  // 將頁面移到指定章節
  // ========================================================================
  app.patch(
    "/api/admin/pages/:pageId/chapter",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { pageId } = req.params;
        const { chapterId } = req.body;

        const page = await storage.getPage(pageId);
        if (!page) {
          return res.status(404).json({ message: "頁面不存在" });
        }

        // chapterId 可以為 null（取消章節歸屬）
        const [updated] = await db
          .update(pages)
          .set({ chapterId: chapterId ?? null })
          .where(eq(pages.id, pageId))
          .returning();

        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "無法更新頁面章節" });
      }
    }
  );
}
