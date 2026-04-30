// 🔒 平台安全設定 schema
//
// platform_ip_whitelist：限制 platform admin 只能從特定 IP/CIDR 登入
//   注意：只對 platform admin 生效，場域 admin 不受限（避免影響玩家用戶端）
import { pgTable, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const platformIpWhitelist = pgTable(
  "platform_ip_whitelist",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ipOrCidr: varchar("ip_or_cidr", { length: 50 }).notNull(), // "192.168.1.1" or "10.0.0.0/24"
    label: varchar("label", { length: 100 }), // 例：辦公室 / 家裡 / VPN
    description: text("description"),
    enabled: boolean("enabled").default(true).notNull(),
    createdByAdminId: varchar("created_by_admin_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_ip_whitelist_enabled").on(table.enabled),
  ]
);

export type PlatformIpWhitelist = typeof platformIpWhitelist.$inferSelect;
