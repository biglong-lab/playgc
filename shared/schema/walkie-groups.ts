// 📻 對講機語音群組（跟遊戲 team 解耦的獨立語音群）
//
// 設計理念：
//   - individual 模式遊戲也能用對講機（玩家不用先組遊戲隊）
//   - 玩家建組 → 產生 6 碼 accessCode → 分享給朋友
//   - 朋友輸入 6 碼加入 → 共享 walkie-group-{id} room
//   - 跟 game session 解耦：甚至不同遊戲的朋友也能語音
//
// 不存檔：跟既有對講機設計一致，LiveKit 端不 recording
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games } from "./games";

// 群組狀態
export const walkieGroupStatusEnum = ["active", "closed"] as const;
export type WalkieGroupStatus = (typeof walkieGroupStatusEnum)[number];

export const walkieGroups = pgTable(
  "walkie_groups",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // 6 碼邀請碼（AB3FX2 格式，排除易混字 0OIL1）
    accessCode: varchar("access_code", { length: 10 }).unique().notNull(),
    // 建立者（群組主）— 關了遊戲自動收
    creatorId: varchar("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // 關聯遊戲（可選；null = 全場域通用）
    // 若指定 gameId，只有在玩這款遊戲的玩家能加入（增加安全）
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "set null",
    }),
    // 顯示名（可選；玩家建組時可取名，否則用 creator 名字）
    displayName: varchar("display_name", { length: 100 }),
    // 狀態：active 可加入；closed 不再允許新人加入但舊人仍可講
    status: varchar("status", { length: 20 }).default("active"),
    // 成員人數上限（預設 20，對應 LiveKit room 上限）
    maxMembers: integer("max_members").default(10),
    // 過期時間（預設建立後 24h 內有效，避免廢棄群組累積）
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_walkie_groups_code").on(table.accessCode),
    index("idx_walkie_groups_creator").on(table.creatorId),
    index("idx_walkie_groups_expires").on(table.expiresAt),
  ],
);

// ============================================================================
// 成員關聯表
// ============================================================================
export const walkieGroupMembers = pgTable(
  "walkie_group_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    groupId: varchar("group_id")
      .references(() => walkieGroups.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at").defaultNow(),
    leftAt: timestamp("left_at"), // null = 還在群組
  },
  (table) => [
    index("idx_walkie_group_members_group").on(table.groupId),
    index("idx_walkie_group_members_user").on(table.userId),
  ],
);

// ============================================================================
// Schemas & Types
// ============================================================================
export const insertWalkieGroupSchema = createInsertSchema(walkieGroups).omit({
  id: true,
  accessCode: true, // 後端自動生成
  createdAt: true,
});
export type InsertWalkieGroup = z.infer<typeof insertWalkieGroupSchema>;
export type WalkieGroup = typeof walkieGroups.$inferSelect;

export const insertWalkieGroupMemberSchema = createInsertSchema(
  walkieGroupMembers,
).omit({ id: true, joinedAt: true, leftAt: true });
export type InsertWalkieGroupMember = z.infer<
  typeof insertWalkieGroupMemberSchema
>;
export type WalkieGroupMember = typeof walkieGroupMembers.$inferSelect;
