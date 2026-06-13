// 🛒 POS 品項目錄 + 客製選項 + 交易明細 + 每日結帳 schema（2026-06-13）
//
// 讓 POS 從「自由輸入金額」升級為「選品項 + 客製 → 自動算總 → 記明細」。
// 三類別：food（餐飲）/ goods（文創商品）/ course（課程，可連結 activities）。
// 金額一律以「分」為單位；結帳時伺服器端用 DB 價格重算（防前端竄改）。

import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const POS_PRODUCT_CATEGORIES = ["food", "goods", "course"] as const;
export type PosProductCategory = (typeof POS_PRODUCT_CATEGORIES)[number];

// ── 品項目錄 ──────────────────────────────────
export const posProducts = pgTable(
  "pos_products",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    /** food | goods | course */
    category: varchar("category", { length: 16 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    photoUrl: text("photo_url"),
    priceCents: integer("price_cents").notNull().default(0),
    /** 課程類可連結既有 activities.id（null = 純品項）*/
    activityId: varchar("activity_id"),
    isActive: boolean("is_active").notNull().default(true),
    /** 售完（暫時不可點）2026-06-13 */
    soldOut: boolean("sold_out").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // 🆕 軟刪除（2026-06-13）
    deletedAt: timestamp("deleted_at"),
    deletedBy: varchar("deleted_by"),
    deleteReason: text("delete_reason"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("idx_pos_products_field_cat").on(t.fieldId, t.category)],
);

// ── 客製群組（糖度 / 冰塊 / 加購）──────────────
export const posModifierGroups = pgTable(
  "pos_modifier_groups",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    /** single = 單選（糖度/冰塊）；multi = 多選（加購）*/
    selectType: varchar("select_type", { length: 10 }).notNull().default("single"),
    /** 是否必選 */
    required: boolean("required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
    deletedBy: varchar("deleted_by"),
    deleteReason: text("delete_reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_pos_modgroup_field").on(t.fieldId)],
);

// ── 客製選項（全糖 / 半糖 / 珍珠…）──────────────
export const posModifierOptions = pgTable(
  "pos_modifier_options",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    groupId: varchar("group_id").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    /** 加價（分）；0 = 免費；可負（折扣）*/
    priceDeltaCents: integer("price_delta_cents").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
    deletedBy: varchar("deleted_by"),
    deleteReason: text("delete_reason"),
  },
  (t) => [index("idx_pos_modopt_group").on(t.groupId)],
);

// ── 品項 ↔ 客製群組 關聯 ──────────────────────
export const posProductModifiers = pgTable(
  "pos_product_modifiers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: varchar("product_id").notNull(),
    groupId: varchar("group_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_pos_prodmod_product").on(t.productId)],
);

// ── 交易明細（line items）──────────────────────
export const posTransactionItems = pgTable(
  "pos_transaction_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    transactionId: varchar("transaction_id").notNull(),
    productId: varchar("product_id"),
    /** 下單當下的品項名稱快照（品項日後改名也保留歷史）*/
    nameSnapshot: varchar("name_snapshot", { length: 120 }).notNull(),
    category: varchar("category", { length: 16 }),
    qty: integer("qty").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** 已選客製快照：[{ groupName, optionName, priceDeltaCents }] */
    modifiers: jsonb("modifiers").default(sql`'[]'::jsonb`),
    /** 該行小計（含客製、含數量）*/
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_pos_txitem_tx").on(t.transactionId)],
);

// ── 每日結帳（shift close）────────────────────
export const shiftCloses = pgTable(
  "shift_closes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    staffId: varchar("staff_id").notNull(),
    /** 結算涵蓋的營業日（Asia/Taipei yyyy-mm-dd）*/
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    totalCents: integer("total_cents").notNull().default(0),
    txnCount: integer("txn_count").notNull().default(0),
    /** 明細聚合快照：{ byCategory, byMethod, byProduct } */
    breakdown: jsonb("breakdown").default(sql`'{}'::jsonb`),
    note: text("note"),
    closedAt: timestamp("closed_at").defaultNow(),
  },
  (t) => [index("idx_shift_close_field_date").on(t.fieldId, t.businessDate)],
);

export type PosProduct = typeof posProducts.$inferSelect;
export type PosProductInsert = typeof posProducts.$inferInsert;
export type PosModifierGroup = typeof posModifierGroups.$inferSelect;
export type PosModifierOption = typeof posModifierOptions.$inferSelect;
export type PosTransactionItem = typeof posTransactionItems.$inferSelect;
export type ShiftClose = typeof shiftCloses.$inferSelect;
