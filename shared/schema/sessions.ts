// 場次 (Sessions) - 遊戲場次、玩家進度、聊天訊息
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games, pages } from "./games";
import { teams } from "./teams";
import { gameChapters } from "./chapters";

// ============================================================================
// Game Sessions table - Active game instances
// ============================================================================
export const gameSessions = pgTable(
  "game_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id").references(() => games.id),
    teamName: varchar("team_name", { length: 100 }),
    playerCount: integer("player_count").default(1),
    status: varchar("status", { length: 20 }).default("playing"), // playing, completed, abandoned
    score: integer("score").default(0),
    currentChapterId: varchar("current_chapter_id").references(() => gameChapters.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_sessions_status").on(table.status, table.startedAt)]
);

// ============================================================================
// Player Progress table - Individual player state in a session
// ============================================================================
export const playerProgress = pgTable("player_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id")
    .references(() => gameSessions.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id").references(() => users.id),
  currentPageId: varchar("current_page_id").references(() => pages.id),
  score: integer("score").default(0), // Player's individual score
  inventory: jsonb("inventory").default([]), // Array of item IDs
  variables: jsonb("variables").default({}), // Game variables
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Chat Messages table - Real-time team chat
// ============================================================================
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }), // Optional: for team chat
    userId: varchar("user_id").references(() => users.id),
    message: text("message").notNull(),
    messageType: varchar("message_type", { length: 20 }).default("text"), // text, system, location, vote
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_chat_messages_session").on(table.sessionId, table.createdAt)]
);

// Game Session schemas
export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Player Progress schemas
export const insertPlayerProgressSchema = createInsertSchema(playerProgress).omit({
  id: true,
  updatedAt: true,
});
export type InsertPlayerProgress = z.infer<typeof insertPlayerProgressSchema>;
export type PlayerProgress = typeof playerProgress.$inferSelect;

// Chat Message schemas
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

