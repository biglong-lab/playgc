// 🗂️ 平台選單 overrides
//
// sidebar 結構在程式碼中宣告（hardcoded），這個表記錄 admin 的覆寫設定：
//   - 隱藏某選項（visibility=false）
//   - 自訂顯示名稱
//   - 自訂排序
//   - groupLabel override（變更分組）
//
// 不存在 override 時預設為原 hardcoded 設定
import { pgTable, varchar, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const platformMenuOverrides = pgTable(
  "platform_menu_overrides",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // 用 menu path 當 unique key（例：/platform/insights）
    menuPath: varchar("menu_path", { length: 200 }).notNull().unique(),
    // 自訂顯示名稱（null = 用預設）
    customLabel: varchar("custom_label", { length: 100 }),
    // 是否顯示
    visible: boolean("visible").default(true).notNull(),
    // 排序（小到大）
    sortOrder: integer("sort_order").default(0),
    // 自訂分組（null = 用預設分組）
    customGroup: varchar("custom_group", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_menu_overrides_path").on(table.menuPath),
    index("idx_platform_menu_overrides_visible").on(table.visible),
  ]
);

export type PlatformMenuOverride = typeof platformMenuOverrides.$inferSelect;
