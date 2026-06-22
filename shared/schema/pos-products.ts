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

// ── 櫃檯現金清點（開班/收班共用）────────────────
// 上班清點(opening) / 下班結算(closing)，面額分張數統計。
// 隔日對帳：今日 opening 預期 = 上次 closing 點鈔 − 之後所有清帳。
export const POS_CASH_COUNT_TYPES = ["opening", "closing"] as const;
export const POS_CASH_VARIANCE_STATUS = ["none", "pending", "confirmed"] as const;
export const CASH_DENOMINATIONS = [1000, 500, 100, 50, 10, 5, 1] as const;

export const posCashCounts = pgTable(
  "pos_cash_counts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    /** Asia/Taipei yyyy-mm-dd */
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    /** opening | closing */
    countType: varchar("count_type", { length: 12 }).notNull(),
    /** 面額張數快照：{ "1000": n, "500": n, "100": n, "50": n, "10": n, "1": n } */
    denominations: jsonb("denominations").default(sql`'{}'::jsonb`),
    /** 點鈔總額（依面額×張數）*/
    countedCents: integer("counted_cents").notNull().default(0),
    /** 系統預期金額（opening=上次closing−清帳；closing=opening+現金收−現金退−當班清帳）*/
    expectedCents: integer("expected_cents").notNull().default(0),
    /** 差異 = counted − expected */
    varianceCents: integer("variance_cents").notNull().default(0),
    varianceReason: text("variance_reason"),
    /** none | pending | confirmed */
    varianceStatus: varchar("variance_status", { length: 12 }).notNull().default("none"),
    /** 確認差異時若選「輸入調整金額」，記調整後金額 */
    adjustmentCents: integer("adjustment_cents"),
    countedBy: varchar("counted_by").notNull(),
    countedByName: varchar("counted_by_name"),
    countedAt: timestamp("counted_at").defaultNow(),
    confirmedBy: varchar("confirmed_by"),
    confirmedByName: varchar("confirmed_by_name"),
    confirmedAt: timestamp("confirmed_at"),
    note: text("note"),
  },
  (t) => [index("idx_pos_cash_count_field_date").on(t.fieldId, t.businessDate)],
);

// ── 清帳（取走現金，僅 pos_cash_admin）──────────
export const posCashDrawdowns = pgTable(
  "pos_cash_drawdowns",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    /** 取走金額（分）*/
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason"),
    drawdownBy: varchar("drawdown_by").notNull(),
    drawdownByName: varchar("drawdown_by_name"),
    drawdownAt: timestamp("drawdown_at").defaultNow(),
  },
  (t) => [index("idx_pos_cash_drawdown_field_date").on(t.fieldId, t.businessDate)],
);

// ── 每日結帳閉環（開帳→記帳→結帳）─────────────────
// 結帳確認後即鎖當日（locked=true）；actualCashCents 成為隔日開帳對帳基礎。
export const posDailySettlements = pgTable(
  "pos_daily_settlements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    /** 結帳當下快照（分）*/
    openingCents: integer("opening_cents").notNull().default(0),
    cashSalesCents: integer("cash_sales_cents").notNull().default(0),
    cashRefundsCents: integer("cash_refunds_cents").notNull().default(0),
    drawdownCents: integer("drawdown_cents").notNull().default(0),
    expectedCashCents: integer("expected_cash_cents").notNull().default(0),
    countedCashCents: integer("counted_cash_cents").notNull().default(0),
    varianceCents: integer("variance_cents").notNull().default(0),
    varianceReason: text("variance_reason"),
    /** 櫃檯實際現金（收班點鈔−清帳）→ 隔日開帳基礎 */
    actualCashCents: integer("actual_cash_cents").notNull().default(0),
    /** 銷售總額（含所有付款方式，給結帳摘要）*/
    salesTotalCents: integer("sales_total_cents").notNull().default(0),
    txnCount: integer("txn_count").notNull().default(0),
    locked: boolean("locked").notNull().default(true),
    settledBy: varchar("settled_by").notNull(),
    settledByName: varchar("settled_by_name"),
    settledAt: timestamp("settled_at").defaultNow(),
    note: text("note"),
  },
  (t) => [index("idx_pos_settlement_field_date").on(t.fieldId, t.businessDate)],
);

// ── 現金調整紀錄（append-only，永不修改/刪除）──────
// 鎖定後管理員調整 → 原紀錄不動、此處追加一筆完整軌跡（人/時間/前後值/原因）。
export const posCashAdjustments = pgTable(
  "pos_cash_adjustments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    /** count | settlement | drawdown */
    targetType: varchar("target_type", { length: 16 }).notNull(),
    targetId: varchar("target_id").notNull(),
    /** 調整的欄位（如 countedCents / actualCashCents）*/
    fieldChanged: varchar("field_changed", { length: 40 }).notNull(),
    oldCents: integer("old_cents"),
    newCents: integer("new_cents"),
    reason: text("reason").notNull(),
    adjustedBy: varchar("adjusted_by").notNull(),
    adjustedByName: varchar("adjusted_by_name"),
    adjustedAt: timestamp("adjusted_at").defaultNow(),
  },
  (t) => [index("idx_pos_cash_adj_field_date").on(t.fieldId, t.businessDate)],
);

export type PosProduct = typeof posProducts.$inferSelect;
export type PosProductInsert = typeof posProducts.$inferInsert;
export type PosModifierGroup = typeof posModifierGroups.$inferSelect;
export type PosModifierOption = typeof posModifierOptions.$inferSelect;
export type PosTransactionItem = typeof posTransactionItems.$inferSelect;
export type ShiftClose = typeof shiftCloses.$inferSelect;
export type PosCashCount = typeof posCashCounts.$inferSelect;
export type PosCashCountInsert = typeof posCashCounts.$inferInsert;
export type PosCashDrawdown = typeof posCashDrawdowns.$inferSelect;
export type PosCashDrawdownInsert = typeof posCashDrawdowns.$inferInsert;
export type PosDailySettlement = typeof posDailySettlements.$inferSelect;
export type PosDailySettlementInsert = typeof posDailySettlements.$inferInsert;
export type PosCashAdjustment = typeof posCashAdjustments.$inferSelect;
export type PosCashAdjustmentInsert = typeof posCashAdjustments.$inferInsert;
