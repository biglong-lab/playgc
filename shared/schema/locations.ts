// 位置 (Locations) - GPS 位置、玩家位置、位置拜訪、導航路徑、成就
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games } from "./games";
import { gameSessions } from "./sessions";

// ============================================================================
// GPS Locations table - Task/checkpoint locations for games
// ============================================================================
export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    locationType: varchar("location_type", { length: 50 }).default("custom"), // task, checkpoint, item, start, finish, puzzle, exploration, experience, team, custom
    icon: varchar("icon", { length: 50 }),
    radius: integer("radius").default(10), // Trigger radius in meters
    points: integer("points").default(0), // Points earned when visiting
    unlockCondition: jsonb("unlock_condition"),
    reward: jsonb("reward"),
    qrCodeData: varchar("qr_code_data", { length: 100 }), // QR code trigger data
    isRequired: boolean("is_required").default(true), // Required for game completion
    status: varchar("status", { length: 20 }).default("active"), // active, inactive, completed
    orderIndex: integer("order_index"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_game_locations").on(table.gameId),
    index("idx_location_type").on(table.locationType),
    index("idx_location_status").on(table.status),
    index("idx_location_coords").on(table.latitude, table.longitude),
    index("idx_location_order").on(table.gameId, table.orderIndex),
  ]
);

// ============================================================================
// Player Locations table - Real-time player GPS tracking
// ============================================================================
export const playerLocations = pgTable(
  "player_locations",
  {
    id: serial("id").primaryKey(),
    gameSessionId: varchar("game_session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    playerId: varchar("player_id")
      .references(() => users.id)
      .notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
    longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
    accuracy: decimal("accuracy", { precision: 6, scale: 2 }), // in meters
    altitude: decimal("altitude", { precision: 8, scale: 2 }), // in meters
    speed: decimal("speed", { precision: 6, scale: 2 }), // in m/s
    heading: decimal("heading", { precision: 5, scale: 2 }), // 0-360 degrees
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_session_player").on(table.gameSessionId, table.playerId),
    index("idx_player_timestamp").on(table.playerId, table.timestamp),
    index("idx_player_location_timestamp").on(table.timestamp),
  ]
);

// ============================================================================
// Location Visits table - Record when players visit locations
// ============================================================================
export const locationVisits = pgTable(
  "location_visits",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id")
      .references(() => locations.id, { onDelete: "cascade" })
      .notNull(),
    gameSessionId: varchar("game_session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    playerId: varchar("player_id")
      .references(() => users.id)
      .notNull(),
    visitedAt: timestamp("visited_at").defaultNow(),
    distanceFromCenter: decimal("distance_from_center", { precision: 6, scale: 2 }), // in meters
    duration: integer("duration"), // in seconds
    completed: boolean("completed").default(false),
  },
  (table) => [
    index("idx_location_visits").on(table.locationId, table.gameSessionId),
    index("idx_player_visits").on(table.playerId, table.gameSessionId),
    index("idx_visit_time").on(table.visitedAt),
    index("idx_completed_visits").on(table.playerId, table.completed),
  ]
);

// ============================================================================
// Navigation Paths table - Predefined navigation routes
// ============================================================================
export const navigationPaths = pgTable(
  "navigation_paths",
  {
    id: serial("id").primaryKey(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }),
    pathData: jsonb("path_data").notNull(), // Array of waypoints [{lat, lng}, ...]
    distance: decimal("distance", { precision: 8, scale: 2 }), // in meters
    estimatedTime: integer("estimated_time"), // in seconds
    difficulty: varchar("difficulty", { length: 20 }), // easy, medium, hard
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_game_paths").on(table.gameId),
    index("idx_path_difficulty").on(table.difficulty),
  ]
);

// ============================================================================
// Achievements table - Game achievements and badges
// ============================================================================
export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    iconUrl: text("icon_url"),
    achievementType: varchar("achievement_type", { length: 50 }).default("location"), // location, special, legendary, collection, speed, exploration
    points: integer("points").default(0),
    condition: jsonb("condition"), // Conditions to unlock: {type: 'visit_location', locationId: 1} or {type: 'collect_items', items: [...]}
    rarity: varchar("rarity", { length: 20 }).default("common"), // common, uncommon, rare, epic, legendary
    isHidden: boolean("is_hidden").default(false), // Hidden until unlocked
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_game_achievements").on(table.gameId),
    index("idx_achievement_type").on(table.achievementType),
  ]
);

// ============================================================================
// Player Achievements table - Track player unlocked achievements
// ============================================================================
export const playerAchievements = pgTable(
  "player_achievements",
  {
    id: serial("id").primaryKey(),
    achievementId: integer("achievement_id")
      .references(() => achievements.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    gameSessionId: varchar("game_session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at").defaultNow(),
  },
  (table) => [
    index("idx_player_achievements").on(table.userId, table.achievementId),
    index("idx_session_achievements").on(table.gameSessionId),
  ]
);

// Location schemas
export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

// Player Location schemas
export const insertPlayerLocationSchema = createInsertSchema(playerLocations).omit({
  id: true,
  timestamp: true,
});
export type InsertPlayerLocation = z.infer<typeof insertPlayerLocationSchema>;
export type PlayerLocation = typeof playerLocations.$inferSelect;

// Location Visit schemas
export const insertLocationVisitSchema = createInsertSchema(locationVisits).omit({
  id: true,
  visitedAt: true,
});
export type InsertLocationVisit = z.infer<typeof insertLocationVisitSchema>;
export type LocationVisit = typeof locationVisits.$inferSelect;

// Navigation Path schemas
export const insertNavigationPathSchema = createInsertSchema(navigationPaths).omit({
  id: true,
  createdAt: true,
});
export type InsertNavigationPath = z.infer<typeof insertNavigationPathSchema>;
export type NavigationPath = typeof navigationPaths.$inferSelect;

// Achievement schemas
export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// Player Achievement schemas
export const insertPlayerAchievementSchema = createInsertSchema(playerAchievements).omit({
  id: true,
  unlockedAt: true,
});
export type InsertPlayerAchievement = z.infer<typeof insertPlayerAchievementSchema>;
export type PlayerAchievement = typeof playerAchievements.$inferSelect;

