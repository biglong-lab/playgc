// 🖼️ 場域素材庫 admin API
//
// 設計：
//   GET    /api/admin/exemplar?fieldId=&gameId=&pageId=&isCurated=  列表查詢
//   POST   /api/admin/exemplar                                       手動上傳
//   PATCH  /api/admin/exemplar/:id                                   更新（標記 curated / 加 tags）
//   DELETE /api/admin/exemplar/:id                                   刪除
//
// 權限：所有 endpoint 需要 game:edit
import type { Express } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import {
  fieldExemplarPhotos,
  type InsertFieldExemplarPhoto,
} from "@shared/schema";

const createSchema = z.object({
  fieldId: z.string().min(1, "缺少 fieldId"),
  gameId: z.string().optional(),
  pageId: z.string().optional(),
  photoUrl: z.string().url("無效的圖片 URL").max(500),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["player_success", "admin_upload", "cron_collected"]).default("admin_upload"),
  isCurated: z.boolean().default(false),
  tags: z.string().max(200).optional(),
  description: z.string().max(300).optional(),
});

const updateSchema = z.object({
  isCurated: z.boolean().optional(),
  tags: z.string().max(200).optional(),
  description: z.string().max(300).optional(),
});

export function registerExemplarRoutes(app: Express) {
  // ============================================================================
  // GET /api/admin/exemplar — 列表查詢
  // ============================================================================
  app.get(
    "/api/admin/exemplar",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const fieldId = (req.query.fieldId as string) || "";
        if (!fieldId) {
          return res.status(400).json({ error: "缺少 fieldId 參數" });
        }
        const gameId = req.query.gameId as string | undefined;
        const pageId = req.query.pageId as string | undefined;
        const isCurated = req.query.isCurated === "true" ? true : req.query.isCurated === "false" ? false : undefined;

        const conditions = [eq(fieldExemplarPhotos.fieldId, fieldId)];
        if (gameId) conditions.push(eq(fieldExemplarPhotos.gameId, gameId));
        if (pageId) conditions.push(eq(fieldExemplarPhotos.pageId, pageId));
        if (isCurated !== undefined) conditions.push(eq(fieldExemplarPhotos.isCurated, isCurated));

        const items = await db
          .select()
          .from(fieldExemplarPhotos)
          .where(and(...conditions))
          .orderBy(desc(fieldExemplarPhotos.isCurated), desc(fieldExemplarPhotos.confidence), desc(fieldExemplarPhotos.createdAt))
          .limit(200);

        res.json({ total: items.length, items });
      } catch (error) {
        console.error("[exemplar] GET 失敗:", error);
        res.status(500).json({ error: "查詢素材庫失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/exemplar — 手動上傳
  // ============================================================================
  app.post(
    "/api/admin/exemplar",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        const insert: InsertFieldExemplarPhoto = {
          fieldId: parsed.data.fieldId,
          gameId: parsed.data.gameId ?? null,
          pageId: parsed.data.pageId ?? null,
          photoUrl: parsed.data.photoUrl,
          confidence: parsed.data.confidence ? String(parsed.data.confidence) : null,
          source: parsed.data.source,
          isCurated: parsed.data.isCurated,
          tags: parsed.data.tags ?? null,
          description: parsed.data.description ?? null,
        };

        const [created] = await db.insert(fieldExemplarPhotos).values(insert).returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "exemplar:create",
          targetType: "field_exemplar_photo",
          targetId: created.id,
          metadata: { fieldId: created.fieldId, source: created.source, isCurated: created.isCurated },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json(created);
      } catch (error) {
        console.error("[exemplar] POST 失敗:", error);
        res.status(500).json({ error: "上傳素材失敗" });
      }
    },
  );

  // ============================================================================
  // PATCH /api/admin/exemplar/:id — 更新（curated / tags / description）
  // ============================================================================
  app.patch(
    "/api/admin/exemplar/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        const [exists] = await db
          .select()
          .from(fieldExemplarPhotos)
          .where(eq(fieldExemplarPhotos.id, id))
          .limit(1);
        if (!exists) {
          return res.status(404).json({ error: "素材不存在" });
        }

        const updates: Partial<InsertFieldExemplarPhoto> = {};
        if (parsed.data.isCurated !== undefined) updates.isCurated = parsed.data.isCurated;
        if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;

        const [updated] = await db
          .update(fieldExemplarPhotos)
          .set(updates)
          .where(eq(fieldExemplarPhotos.id, id))
          .returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "exemplar:update",
          targetType: "field_exemplar_photo",
          targetId: id,
          metadata: { changes: parsed.data },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json(updated);
      } catch (error) {
        console.error("[exemplar] PATCH 失敗:", error);
        res.status(500).json({ error: "更新素材失敗" });
      }
    },
  );

  // ============================================================================
  // DELETE /api/admin/exemplar/:id — 刪除
  // ============================================================================
  app.delete(
    "/api/admin/exemplar/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const [deleted] = await db
          .delete(fieldExemplarPhotos)
          .where(eq(fieldExemplarPhotos.id, id))
          .returning();
        if (!deleted) {
          return res.status(404).json({ error: "素材不存在" });
        }

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "exemplar:delete",
          targetType: "field_exemplar_photo",
          targetId: id,
          metadata: { fieldId: deleted.fieldId },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true });
      } catch (error) {
        console.error("[exemplar] DELETE 失敗:", error);
        res.status(500).json({ error: "刪除素材失敗" });
      }
    },
  );
}
