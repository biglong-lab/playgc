// 🛒 POS 品項目錄 + 客製管理 API（2026-06-13）
//
// Endpoints（皆 requireAdminAuth、寫入需 game:edit、場域隔離）：
//   GET    /api/admin/pos/products                  列品項（含連結的客製群組 id）
//   POST   /api/admin/pos/products                  建品項
//   PATCH  /api/admin/pos/products/:id              改品項
//   DELETE /api/admin/pos/products/:id              刪品項（連同 product↔group 關聯）
//   POST   /api/admin/pos/products/:id/photo        上傳品項照片（Cloudinary）
//   PUT    /api/admin/pos/products/:id/modifiers    設定該品項的客製群組（覆寫關聯）
//   GET    /api/admin/pos/modifier-groups           列客製群組（含選項）
//   POST   /api/admin/pos/modifier-groups           建群組
//   PATCH  /api/admin/pos/modifier-groups/:id       改群組
//   DELETE /api/admin/pos/modifier-groups/:id       刪群組（連同選項、關聯）
//   POST   /api/admin/pos/modifier-groups/:id/options  加選項
//   PATCH  /api/admin/pos/modifier-options/:id       改選項
//   DELETE /api/admin/pos/modifier-options/:id       刪選項
//   GET    /api/pos/menu                             POS 結帳用：active 品項(依類別) + 客製
//   GET    /api/admin/pos/trash                      垃圾桶：已軟刪除的品項 / 客製群組 / 交易 / 現金支出
//   POST   /api/admin/pos/restore                    從垃圾桶還原（type: product | modifierGroup | transaction | expense）

import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  posProducts,
  posModifierGroups,
  posModifierOptions,
  posProductModifiers,
  posTransactions,
  POS_PRODUCT_CATEGORIES,
} from "@shared/schema";
import { eq, and, inArray, asc, isNull, desc, sql } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { listDeletedExpenses, restoreDeletedExpense } from "./pos-expense-trash";

function err(res: import("express").Response, e: unknown) {
  console.error("[admin-pos-products]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

const productSchema = z.object({
  category: z.enum(POS_PRODUCT_CATEGORIES),
  name: z.string().min(1).max(120),
  priceCents: z.number().int().min(0),
  photoUrl: z.string().optional(),
  activityId: z.string().optional(),
  isActive: z.boolean().optional(),
  soldOut: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1).max(60),
  selectType: z.enum(["single", "multi"]).default("single"),
  required: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

const optionSchema = z.object({
  name: z.string().min(1).max(60),
  priceDeltaCents: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

/**
 * 讀取品項 / 菜單 / 客製 / 垃圾桶：能看、能現場操作、能設定 POS 的都要能讀
 * 🐛 2026-09-26：只認 pos:view 時，只有 pos:manage / pos:operate 的角色被 403 →
 *   收支頁「尚無品項」、品項設定頁空白，現場停擺。requirePermission 是 ANY 語意。
 */
const POS_READ = ["pos:view", "pos:operate", "pos:manage"] as const;

export function registerAdminPosProductRoutes(app: Express) {
  // ── 品項 ──────────────────────────────────
  app.get("/api/admin/pos/products", requireAdminAuth, requirePermission(...POS_READ), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const products = await db
        .select()
        .from(posProducts)
        .where(and(eq(posProducts.fieldId, fieldId), isNull(posProducts.deletedAt)))
        .orderBy(asc(posProducts.category), asc(posProducts.sortOrder));
      const links = await db.select().from(posProductModifiers);
      const withMods = products.map((p) => ({
        ...p,
        modifierGroupIds: links.filter((l) => l.productId === p.id).map((l) => l.groupId),
      }));
      res.json({ products: withMods });
    } catch (e) {
      err(res, e);
    }
  });

  app.post("/api/admin/pos/products", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = productSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation", message: p.error.errors[0]?.message });
      const [created] = await db
        .insert(posProducts)
        .values({ ...p.data, fieldId: req.admin!.fieldId })
        .returning();
      res.json({ product: created });
    } catch (e) {
      err(res, e);
    }
  });

  app.patch("/api/admin/pos/products/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = productSchema.partial().safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation", message: p.error.errors[0]?.message });
      const [updated] = await db
        .update(posProducts)
        .set({ ...p.data, updatedAt: new Date() })
        .where(and(eq(posProducts.id, req.params.id), eq(posProducts.fieldId, req.admin!.fieldId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ product: updated });
    } catch (e) {
      err(res, e);
    }
  });

  app.delete("/api/admin/pos/products/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 2) return res.status(400).json({ error: "reason_required", message: "請填刪除原因" });
      // 軟刪除（進垃圾桶、可還原）
      const [updated] = await db
        .update(posProducts)
        .set({ deletedAt: new Date(), deletedBy: req.admin!.id, deleteReason: reason, updatedAt: new Date() })
        .where(and(eq(posProducts.id, req.params.id), eq(posProducts.fieldId, req.admin!.fieldId), isNull(posProducts.deletedAt)))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) {
      err(res, e);
    }
  });

  app.post("/api/admin/pos/products/:id/photo", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const imageData = req.body?.imageData;
      if (typeof imageData !== "string" || !imageData.startsWith("data:")) {
        return res.status(400).json({ error: "validation", message: "請提供 base64 圖片" });
      }
      const { cloudinaryService } = await import("../cloudinary");
      const result = await cloudinaryService.uploadImage(imageData, {
        folder: "pos-products",
        publicId: `pos_${req.params.id}`,
      });
      const [updated] = await db
        .update(posProducts)
        .set({ photoUrl: result.secure_url, updatedAt: new Date() })
        .where(and(eq(posProducts.id, req.params.id), eq(posProducts.fieldId, req.admin!.fieldId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ product: updated });
    } catch (e) {
      err(res, e);
    }
  });

  app.put("/api/admin/pos/products/:id/modifiers", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const groupIds = z.array(z.string()).safeParse(req.body?.groupIds);
      if (!groupIds.success) return res.status(400).json({ error: "validation" });
      await db.delete(posProductModifiers).where(eq(posProductModifiers.productId, req.params.id));
      if (groupIds.data.length > 0) {
        await db.insert(posProductModifiers).values(
          groupIds.data.map((gid, i) => ({ productId: req.params.id, groupId: gid, sortOrder: i })),
        );
      }
      res.json({ ok: true });
    } catch (e) {
      err(res, e);
    }
  });

  // ── 客製群組 + 選項 ──────────────────────────
  app.get("/api/admin/pos/modifier-groups", requireAdminAuth, requirePermission(...POS_READ), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const groups = await db
        .select()
        .from(posModifierGroups)
        .where(and(eq(posModifierGroups.fieldId, fieldId), isNull(posModifierGroups.deletedAt)))
        .orderBy(asc(posModifierGroups.sortOrder));
      const gids = groups.map((g) => g.id);
      const options = gids.length
        ? await db.select().from(posModifierOptions).where(and(inArray(posModifierOptions.groupId, gids), isNull(posModifierOptions.deletedAt))).orderBy(asc(posModifierOptions.sortOrder))
        : [];
      res.json({
        groups: groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) })),
      });
    } catch (e) {
      err(res, e);
    }
  });

  app.post("/api/admin/pos/modifier-groups", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = groupSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation", message: p.error.errors[0]?.message });
      const [created] = await db.insert(posModifierGroups).values({ ...p.data, fieldId: req.admin!.fieldId }).returning();
      res.json({ group: created });
    } catch (e) {
      err(res, e);
    }
  });

  app.patch("/api/admin/pos/modifier-groups/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = groupSchema.partial().safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation" });
      const [updated] = await db
        .update(posModifierGroups)
        .set(p.data)
        .where(and(eq(posModifierGroups.id, req.params.id), eq(posModifierGroups.fieldId, req.admin!.fieldId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ group: updated });
    } catch (e) {
      err(res, e);
    }
  });

  app.delete("/api/admin/pos/modifier-groups/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 2) return res.status(400).json({ error: "reason_required", message: "請填刪除原因" });
      const [updated] = await db
        .update(posModifierGroups)
        .set({ deletedAt: new Date(), deletedBy: req.admin!.id, deleteReason: reason })
        .where(and(eq(posModifierGroups.id, req.params.id), eq(posModifierGroups.fieldId, req.admin!.fieldId), isNull(posModifierGroups.deletedAt)))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) {
      err(res, e);
    }
  });

  app.post("/api/admin/pos/modifier-groups/:id/options", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = optionSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation", message: p.error.errors[0]?.message });
      const [created] = await db.insert(posModifierOptions).values({ ...p.data, groupId: req.params.id }).returning();
      res.json({ option: created });
    } catch (e) {
      err(res, e);
    }
  });

  app.patch("/api/admin/pos/modifier-options/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const p = optionSchema.partial().safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "validation" });
      const [updated] = await db.update(posModifierOptions).set(p.data).where(eq(posModifierOptions.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      res.json({ option: updated });
    } catch (e) {
      err(res, e);
    }
  });

  app.delete("/api/admin/pos/modifier-options/:id", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      // 選項刪除為小操作、原因選填（群組/品項/帳務刪除才強制）
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      await db
        .update(posModifierOptions)
        .set({ deletedAt: new Date(), deletedBy: req.admin!.id, deleteReason: reason || "（未填）" })
        .where(eq(posModifierOptions.id, req.params.id));
      res.json({ ok: true });
    } catch (e) {
      err(res, e);
    }
  });

  // ── 一鍵建立預設客製（糖度 / 冰塊）──────────────
  app.post("/api/admin/pos/seed-default-modifiers", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const existing = await db.select().from(posModifierGroups).where(eq(posModifierGroups.fieldId, fieldId));
      const have = new Set(existing.map((g) => g.name));
      const presets: Array<{ name: string; options: string[] }> = [
        { name: "糖度", options: ["全糖", "半糖", "五分糖", "三分糖", "無糖"] },
        { name: "冰塊", options: ["正常冰", "少冰", "微冰", "去冰", "熱"] },
      ];
      const created: string[] = [];
      for (const preset of presets) {
        if (have.has(preset.name)) continue;
        const [g] = await db
          .insert(posModifierGroups)
          .values({ fieldId, name: preset.name, selectType: "single", required: false })
          .returning();
        await db.insert(posModifierOptions).values(
          preset.options.map((name, i) => ({ groupId: g.id, name, priceDeltaCents: 0, isDefault: i === 0, sortOrder: i })),
        );
        created.push(preset.name);
      }
      res.json({ created });
    } catch (e) {
      err(res, e);
    }
  });

  // ── POS 結帳用菜單（active 品項 + 客製）──────────
  app.get("/api/pos/menu", requireAdminAuth, requirePermission(...POS_READ), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const products = await db
        .select()
        .from(posProducts)
        .where(and(eq(posProducts.fieldId, fieldId), eq(posProducts.isActive, true), isNull(posProducts.deletedAt)))
        .orderBy(asc(posProducts.category), asc(posProducts.sortOrder));
      const groups = await db.select().from(posModifierGroups).where(and(eq(posModifierGroups.fieldId, fieldId), isNull(posModifierGroups.deletedAt)));
      const gids = groups.map((g) => g.id);
      const options = gids.length
        ? await db.select().from(posModifierOptions).where(and(inArray(posModifierOptions.groupId, gids), isNull(posModifierOptions.deletedAt))).orderBy(asc(posModifierOptions.sortOrder))
        : [];
      const links = await db.select().from(posProductModifiers);
      const groupWithOpts = groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) }));
      const menu = products.map((p) => ({
        ...p,
        modifierGroups: links
          .filter((l) => l.productId === p.id)
          .map((l) => groupWithOpts.find((g) => g.id === l.groupId))
          .filter(Boolean),
      }));
      res.json({ products: menu });
    } catch (e) {
      err(res, e);
    }
  });

  // ── 垃圾桶：列已軟刪除的 POS 資料 ──────────────
  app.get("/api/admin/pos/trash", requireAdminAuth, requirePermission(...POS_READ), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const delProducts = await db
        .select()
        .from(posProducts)
        .where(and(eq(posProducts.fieldId, fieldId), sql`${posProducts.deletedAt} IS NOT NULL`))
        .orderBy(desc(posProducts.deletedAt));
      const delGroups = await db
        .select()
        .from(posModifierGroups)
        .where(and(eq(posModifierGroups.fieldId, fieldId), sql`${posModifierGroups.deletedAt} IS NOT NULL`))
        .orderBy(desc(posModifierGroups.deletedAt));
      const delTxns = await db
        .select()
        .from(posTransactions)
        .where(and(eq(posTransactions.fieldId, fieldId), sql`${posTransactions.deletedAt} IS NOT NULL`))
        .orderBy(desc(posTransactions.deletedAt))
        .limit(200);
      const delExpenses = await listDeletedExpenses(req);
      res.json({ products: delProducts, modifierGroups: delGroups, transactions: delTxns, expenses: delExpenses });
    } catch (e) {
      err(res, e);
    }
  });

  // ── 還原（從垃圾桶取回）──────────────────────
  app.post("/api/admin/pos/restore", requireAdminAuth, requirePermission("pos:manage"), async (req, res) => {
    try {
      const { type, id } = req.body ?? {};
      if (!type || typeof id !== "string" || !id) return res.status(400).json({ error: "validation" });
      // 現金支出：場域以 id / code 雙識別、需檢查該日是否已交班鎖帳 → 另行處理
      if (type === "expense") {
        // 🔒 2026-09-23 安全審查 M7：現金支出影響當日對帳 → 要財務權限，不能只有內容編輯權
        const canCash = req.admin!.systemRole === "super_admin" || req.admin!.permissions.includes("pos_cash_admin");
        if (!canCash) {
          return res.status(403).json({ error: "forbidden", message: "還原現金支出需要現金管理權限" });
        }
        const result = await restoreDeletedExpense(req, id);
        return res.status(result.status).json(result.body);
      }
      const clear = { deletedAt: null, deletedBy: null, deleteReason: null };
      if (type === "product") {
        await db.update(posProducts).set({ ...clear, updatedAt: new Date() }).where(and(eq(posProducts.id, id), eq(posProducts.fieldId, req.admin!.fieldId)));
      } else if (type === "modifierGroup") {
        await db.update(posModifierGroups).set(clear).where(and(eq(posModifierGroups.id, id), eq(posModifierGroups.fieldId, req.admin!.fieldId)));
      } else if (type === "transaction") {
        await db.update(posTransactions).set(clear).where(and(eq(posTransactions.id, id), eq(posTransactions.fieldId, req.admin!.fieldId)));
      } else {
        return res.status(400).json({ error: "unknown_type" });
      }
      res.json({ ok: true });
    } catch (e) {
      err(res, e);
    }
  });
}
