// 📚 管理端章節模板路由 — 跨遊戲章節重用
//
// Routes:
//   GET    /api/admin/fields/:fieldId/chapter-templates       — 列出模板
//   POST   /api/admin/chapters/:chapterId/save-as-template    — 把章節存成模板
//   POST   /api/admin/chapter-templates/:id/import            — 匯入到指定遊戲
//   PATCH  /api/admin/chapter-templates/:id                   — 更新 metadata
//   DELETE /api/admin/chapter-templates/:id                   — 刪除模板

import type { Express } from "express";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import {
  saveChapterAsTemplate,
  listChapterTemplates,
  importChapterFromTemplate,
  deleteChapterTemplate,
  updateChapterTemplateMeta,
} from "../services/chapter-templates";
import { storage } from "../storage";
import { z } from "zod";

const saveTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().max(50).optional(),
});

const importTemplateSchema = z.object({
  targetGameId: z.string().min(1),
  chapterOrder: z.number().int().positive().optional(),
  remapItemsBySlug: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().max(50).optional(),
  coverImageUrl: z.string().optional(),
});

export function registerAdminChapterTemplateRoutes(app: Express) {
  // ========================================================================
  // 列出場域的章節模板
  // ========================================================================
  app.get(
    "/api/admin/fields/:fieldId/chapter-templates",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { fieldId } = req.params;
        const { category } = req.query;
        const templates = await listChapterTemplates(fieldId, {
          category: typeof category === "string" ? category : undefined,
        });
        res.json(templates);
      } catch (error) {
        console.error("[chapter-templates] list failed:", error);
        res.status(500).json({ message: "無法取得模板列表" });
      }
    },
  );

  // ========================================================================
  // 把現有章節存成模板
  // ========================================================================
  app.post(
    "/api/admin/chapters/:chapterId/save-as-template",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ message: "未認證" });
        }

        const { chapterId } = req.params;
        const body = saveTemplateSchema.parse(req.body);

        // 找章節 + 關聯遊戲 → 推算 fieldId
        const chapter = await storage.getChapter(chapterId);
        if (!chapter) {
          return res.status(404).json({ message: "章節不存在" });
        }
        const game = await storage.getGame(chapter.gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }
        const fieldId = (game as { fieldId?: string | null }).fieldId;
        if (!fieldId) {
          return res.status(400).json({
            message: "此遊戲未歸屬任何場域，無法建立模板（請先設定場域）",
          });
        }

        const template = await saveChapterAsTemplate({
          fieldId,
          chapterId,
          createdBy: req.admin.accountId, // admin_accounts.id
          title: body.title,
          description: body.description,
          category: body.category,
        });
        res.status(201).json(template);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        console.error("[chapter-templates] save failed:", error);
        res.status(500).json({ message: "無法建立模板" });
      }
    },
  );

  // ========================================================================
  // 從模板匯入到指定遊戲
  // ========================================================================
  app.post(
    "/api/admin/chapter-templates/:id/import",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const body = importTemplateSchema.parse(req.body);

        const result = await importChapterFromTemplate({
          templateId: id,
          targetGameId: body.targetGameId,
          chapterOrder: body.chapterOrder,
          remapItemsBySlug: body.remapItemsBySlug,
        });

        res.status(201).json({
          message: "章節已匯入",
          chapter: result.chapter,
          pagesCreated: result.pagesCreated.length,
          needsManualReconfigure: result.needsManualReconfigure,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        console.error("[chapter-templates] import failed:", error);
        res.status(500).json({
          message: "匯入失敗",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ========================================================================
  // 更新模板 metadata
  // ========================================================================
  app.patch(
    "/api/admin/chapter-templates/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const data = updateTemplateSchema.parse(req.body);
        const updated = await updateChapterTemplateMeta(id, data);
        if (!updated) {
          return res.status(404).json({ message: "模板不存在" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        console.error("[chapter-templates] update failed:", error);
        res.status(500).json({ message: "無法更新模板" });
      }
    },
  );

  // ========================================================================
  // 刪除模板
  // ========================================================================
  app.delete(
    "/api/admin/chapter-templates/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await deleteChapterTemplate(id);
        res.json({ message: "模板已刪除" });
      } catch (error) {
        console.error("[chapter-templates] delete failed:", error);
        res.status(500).json({ message: "無法刪除模板" });
      }
    },
  );
}
