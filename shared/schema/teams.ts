// 組隊 (Teams) - 團隊、成員、投票、分數歷史、隨機事件
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games, pages } from "./games";
import { gameSessions } from "./sessions";

// ============================================================================
// Teams table - Team formation for team mode games
// ============================================================================
export const teamStatusEnum = ["forming", "ready", "playing", "completed", "disbanded"] as const;
export type TeamStatus = typeof teamStatusEnum[number];

export const teamRoleEnum = ["leader", "member"] as const;
export type TeamRole = typeof teamRoleEnum[number];

export const teams = pgTable(
  "teams",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    accessCode: varchar("access_code", { length: 10 }).unique().notNull(), // 6-character code for joining
    leaderId: varchar("leader_id").references(() => users.id),
    status: varchar("status", { length: 20 }).default("forming"), // forming, ready, playing, completed, disbanded
    minPlayers: integer("min_players").default(2),
    maxPlayers: integer("max_players").default(6),
    settings: jsonb("settings").default({}), // Team-specific settings
    createdAt: timestamp("created_at").defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_teams_game").on(table.gameId),
    index("idx_teams_access_code").on(table.accessCode),
    index("idx_teams_status").on(table.status),
  ]
);

// ============================================================================
// Team Members table - Players in a team
// ============================================================================
export const teamMembers = pgTable(
  "team_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).default("member"), // leader, member
    isReady: boolean("is_ready").default(false),
    joinedAt: timestamp("joined_at").defaultNow(),
    leftAt: timestamp("left_at"),
  },
  (table) => [
    index("idx_team_members_team").on(table.teamId),
    index("idx_team_members_user").on(table.userId),
  ]
);

// ============================================================================
// Team Sessions table - Links team to game session with team-specific data
// ============================================================================
export const teamSessions = pgTable(
  "team_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: varchar("session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    teamScore: integer("team_score").default(0), // Shared team score
    currentPageId: varchar("current_page_id").references(() => pages.id),
    teamInventory: jsonb("team_inventory").default([]), // Shared team items
    teamVariables: jsonb("team_variables").default({}), // Shared team variables
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_team_sessions_team").on(table.teamId),
    index("idx_team_sessions_session").on(table.sessionId),
  ]
);

// ============================================================================
// Team Votes table - Voting mechanism for team decisions
// ============================================================================
export const voteStatusEnum = ["active", "completed", "cancelled", "expired"] as const;
export type VoteStatus = typeof voteStatusEnum[number];

export const teamVotes = pgTable(
  "team_votes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    pageId: varchar("page_id").references(() => pages.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    options: jsonb("options").notNull(), // Array of {id, label, targetPageId?, points?}
    requiredVotes: integer("required_votes"), // Minimum votes needed, null = majority
    votingMode: varchar("voting_mode", { length: 20 }).default("majority"), // majority, unanimous, threshold
    status: varchar("status", { length: 20 }).default("active"), // active, completed, cancelled, expired
    winningOptionId: varchar("winning_option_id"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_team_votes_team").on(table.teamId),
    index("idx_team_votes_status").on(table.status),
  ]
);

// ============================================================================
// Team Vote Ballots table - Individual votes cast by team members
// ============================================================================
export const teamVoteBallots = pgTable(
  "team_vote_ballots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    voteId: varchar("vote_id")
      .references(() => teamVotes.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    optionId: varchar("option_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_team_vote_ballots_vote").on(table.voteId),
    index("idx_team_vote_ballots_user").on(table.userId),
  ]
);

// ============================================================================
// Team Score History table - Track score changes with reasons
// ============================================================================
export const teamScoreHistory = pgTable(
  "team_score_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    delta: integer("delta").notNull(), // Points added or subtracted
    runningTotal: integer("running_total").notNull(),
    sourceType: varchar("source_type", { length: 50 }).notNull(), // page_completion, vote_result, random_event, manual, penalty
    sourceId: varchar("source_id"), // Reference to page, vote, or event ID
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_team_score_history_team").on(table.teamId),
    index("idx_team_score_history_created").on(table.createdAt),
  ]
);

// ============================================================================
// Random Events table - Fortune wheel, random bonuses/penalties
// ============================================================================
export const randomEventTypeEnum = ["fortune_wheel", "random_bonus", "random_penalty", "mystery_box", "triggered"] as const;
export type RandomEventType = typeof randomEventTypeEnum[number];

export const randomEvents = pgTable(
  "random_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(), // fortune_wheel, random_bonus, random_penalty, mystery_box, triggered
    outcomes: jsonb("outcomes").notNull(), // Array of {id, label, weight, points?, gotoPageId?, grantItemId?, message?}
    triggerCondition: jsonb("trigger_condition"), // Conditions that trigger this event
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_random_events_game").on(table.gameId),
  ]
);

// ============================================================================
// Random Event Occurrences table - Log of triggered random events
// ============================================================================
export const randomEventOccurrences = pgTable(
  "random_event_occurrences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: varchar("event_id")
      .references(() => randomEvents.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: varchar("session_id").references(() => gameSessions.id, { onDelete: "cascade" }),
    teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => users.id),
    outcomeId: varchar("outcome_id").notNull(),
    outcomeData: jsonb("outcome_data"), // The actual outcome that was selected
    triggeredAt: timestamp("triggered_at").defaultNow(),
  },
  (table) => [
    index("idx_random_event_occurrences_event").on(table.eventId),
    index("idx_random_event_occurrences_session").on(table.sessionId),
    index("idx_random_event_occurrences_team").on(table.teamId),
  ]
);

// Team schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Team Member schemas
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
  leftAt: true,
});
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

// Team Session schemas
export const insertTeamSessionSchema = createInsertSchema(teamSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeamSession = z.infer<typeof insertTeamSessionSchema>;
export type TeamSession = typeof teamSessions.$inferSelect;

// Team Vote schemas
export const insertTeamVoteSchema = createInsertSchema(teamVotes).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertTeamVote = z.infer<typeof insertTeamVoteSchema>;
export type TeamVote = typeof teamVotes.$inferSelect;

// Team Vote Ballot schemas
export const insertTeamVoteBallotSchema = createInsertSchema(teamVoteBallots).omit({
  id: true,
  createdAt: true,
});
export type InsertTeamVoteBallot = z.infer<typeof insertTeamVoteBallotSchema>;
export type TeamVoteBallot = typeof teamVoteBallots.$inferSelect;

// Team Score History schemas
export const insertTeamScoreHistorySchema = createInsertSchema(teamScoreHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertTeamScoreHistory = z.infer<typeof insertTeamScoreHistorySchema>;
export type TeamScoreHistory = typeof teamScoreHistory.$inferSelect;

// Random Event schemas
export const insertRandomEventSchema = createInsertSchema(randomEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertRandomEvent = z.infer<typeof insertRandomEventSchema>;
export type RandomEvent = typeof randomEvents.$inferSelect;

// Random Event Occurrence schemas
export const insertRandomEventOccurrenceSchema = createInsertSchema(randomEventOccurrences).omit({
  id: true,
  triggeredAt: true,
});
export type InsertRandomEventOccurrence = z.infer<typeof insertRandomEventOccurrenceSchema>;
export type RandomEventOccurrence = typeof randomEventOccurrences.$inferSelect;

