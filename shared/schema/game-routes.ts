// 🎮 多腳本架構（Game Routes）
//
// 一個 game 可以有多條 route（劇情分支 / 難度分支 / 角色分支）：
//   - 英雄路線：開場 → 戰鬥 → 救援 → 結局 1
//   - 間諜路線：開場 → 潛入 → 解碼 → 結局 2
//   - 考古路線：開場 → 探勘 → 解謎 → 結局 3
//
// 每條 route 指向一個 startPageId，玩家進入時可選 route 走（或預設第一條）。
//
// 同時定義 coop_sync_points（多人協作同步點）。
import { pgTable, varchar, integer, boolean, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { pages } from "./games";

// ============================================================================
// game_routes — 一個遊戲的多條路線
// ============================================================================
export const gameRoutes = pgTable(
  "game_routes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    /** 路線名稱（顯示給玩家看） */
    routeName: varchar("route_name", { length: 50 }).notNull(),
    /** 進入頁面 ID（必須是 pages.id 但用 soft ref 避免 cascade 複雜化） */
    startPageId: varchar("start_page_id", { length: 50 }),
    /** 路線描述 */
    description: text("description"),
    /** 難度（easy / medium / hard） */
    difficulty: varchar("difficulty", { length: 20 }),
    /** 預估時長（分鐘） */
    estimatedMinutes: integer("estimated_minutes"),
    /** 是否啟用（admin 可暫時停用某條路線） */
    isActive: boolean("is_active").default(true).notNull(),
    /** 顯示順序 */
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_game_routes_game").on(table.gameId),
    index("idx_game_routes_active").on(table.gameId, table.isActive),
  ],
);

export type GameRoute = typeof gameRoutes.$inferSelect;
export type InsertGameRoute = typeof gameRoutes.$inferInsert;

// ============================================================================
// coop_sync_points — 多人協作同步點（隊員都到才解鎖）
// ============================================================================
export const coopSyncPoints = pgTable(
  "coop_sync_points",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    /** 哪一頁是同步點（玩家到此頁要等隊員） */
    pageId: varchar("page_id")
      .references(() => pages.id, { onDelete: "cascade" })
      .notNull(),
    /** 需要多少隊員到位才解鎖 */
    requiredTeamSize: integer("required_team_size").default(2).notNull(),
    /** 解鎖條件：'all_arrived' / 'majority_voted' / 'first_arrived' */
    unlockCondition: varchar("unlock_condition", { length: 30 })
      .default("all_arrived")
      .notNull(),
    /** 等待超時（秒，超過後依 timeout_action 處理） */
    timeoutSeconds: integer("timeout_seconds"),
    /** timeout 後的動作：'continue' (依 majority) / 'skip' / 'fail' */
    timeoutAction: varchar("timeout_action", { length: 20 }).default("continue"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_coop_sync_game").on(table.gameId),
    index("idx_coop_sync_page").on(table.pageId),
  ],
);

export type CoopSyncPoint = typeof coopSyncPoints.$inferSelect;
export type InsertCoopSyncPoint = typeof coopSyncPoints.$inferInsert;

// ============================================================================
// 解鎖條件 enum
// ============================================================================
export const unlockConditionEnum = ["all_arrived", "majority_voted", "first_arrived"] as const;
export type UnlockCondition = (typeof unlockConditionEnum)[number];

export const timeoutActionEnum = ["continue", "skip", "fail"] as const;
export type TimeoutAction = (typeof timeoutActionEnum)[number];
