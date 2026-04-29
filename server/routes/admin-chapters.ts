// 管理端章節路由 - 章節 CRUD、排序、頁面分配
import type { Express, Response } from "express";
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
import { assertFieldOwnership, type AdminLike } from "../lib/field-ownership";

// 🔒 helper：驗證 admin 對指定 gameId 有權限（透過 game.fieldId 比對）
async function checkGameFieldOwnership(
  gameId: string,
  admin: AdminLike | undefined | null,
  res: Response,
): Promise<{ game: any } | null> {
  const game = await storage.getGame(gameId);
  if (!game) {
    res.status(404).json({ message: "遊戲不存在" });
    return null;
  }
  if (!assertFieldOwnership(admin, game.fieldId, res)) return null;
  return { game };
}

// 🔒 helper：驗證 admin 對指定 chapterId 有權限（chapter → game → fieldId）
async function checkChapterFieldOwnership(
  chapterId: string,
  admin: AdminLike | undefined | null,
  res: Response,
): Promise<{ chapter: any; game: any } | null> {
  const chapter = await storage.getChapter(chapterId);
  if (!chapter) {
    res.status(404).json({ message: "章節不存在" });
    return null;
  }
  const result = await checkGameFieldOwnership(chapter.gameId, admin, res);
  if (!result) return null;
  return { chapter, game: result.game };
}

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
        // 🔒 場域隔離
        if (!(await checkGameFieldOwnership(gameId, req.admin, res))) return;

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
        // 🔒 場域隔離（含 game 存在檢查）
        const owned = await checkGameFieldOwnership(gameId, req.admin, res);
        if (!owned) return;

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
  // 重新排序章節（靜態路由需在 :id 動態路由之前）
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
        // 🔒 場域隔離
        if (!(await checkGameFieldOwnership(gameId, req.admin, res))) return;

        await storage.reorderChapters(gameId, chapterIds);
        const chapters = await storage.getChapters(gameId);
        res.json(chapters);
      } catch (error) {
        res.status(500).json({ message: "無法重新排序" });
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
        // 🔒 場域隔離
        const owned = await checkChapterFieldOwnership(id, req.admin, res);
        if (!owned) return;

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
