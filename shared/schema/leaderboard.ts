// 排行榜 (Leaderboard) - 遊戲排行榜
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { games } from "./games";
import { gameSessions } from "./sessions";

// ============================================================================
// Leaderboard table - Game rankings
// ============================================================================
export const leaderboard = pgTable(
  "leaderboard",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id").references(() => games.id),
    sessionId: varchar("session_id").references(() => gameSessions.id),
    teamName: varchar("team_name", { length: 100 }),
    totalScore: integer("total_score"),
    completionTimeSeconds: integer("completion_time_seconds"),
    rank: integer("rank"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_leaderboard_game").on(table.gameId)]
);

// Leaderboard schemas
export const insertLeaderboardSchema = createInsertSchema(leaderboard).omit({
  id: true,
  createdAt: true,
});
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;

