import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
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

// ============================================================================
// Session storage table - Required for Replit Auth
// ============================================================================
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// ============================================================================
// Fields table - 場域/Venue management
// ============================================================================
export const fields = pgTable("fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).unique().notNull(), // Unique field code for login
  description: text("description"),
  address: text("address"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").default({}), // Field-specific settings
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, suspended
  codeLastChangedAt: timestamp("code_last_changed_at"), // Track when code was last changed for 6-month lock
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// System Roles - Predefined role types
// ============================================================================
export const systemRoleEnum = ["super_admin", "field_manager", "field_director", "field_executor", "custom", "player"] as const;
export type SystemRole = typeof systemRoleEnum[number];

// ============================================================================
// Roles table - Role definitions (system and custom)
// ============================================================================
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").references(() => fields.id, { onDelete: "cascade" }), // null for system roles
  name: varchar("name", { length: 100 }).notNull(),
  systemRole: varchar("system_role", { length: 50 }).default("custom"), // super_admin, field_manager, field_director, field_executor, custom, player
  description: text("description"),
  isCustom: boolean("is_custom").default(true),
  isDefault: boolean("is_default").default(false), // Default role for new users in this field
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Permissions table - Available permissions
// ============================================================================
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).unique().notNull(), // e.g., "game:create", "game:edit", "device:manage"
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(), // game, session, device, analytics, user, field, system
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Role Permissions table - Maps permissions to roles
// ============================================================================
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    roleId: varchar("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: varchar("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
    allow: boolean("allow").default(true),
    scope: jsonb("scope").default({}), // Optional scope restrictions {fieldId?, gameId?}
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_role_permissions_role").on(table.roleId),
    index("idx_role_permissions_permission").on(table.permissionId),
  ]
);

// ============================================================================
// User Roles table - Assigns roles to users
// ============================================================================
export const userRoles = pgTable(
  "user_roles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    roleId: varchar("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    fieldId: varchar("field_id").references(() => fields.id, { onDelete: "cascade" }), // Scoped to specific field
    gameId: varchar("game_id").references(() => games.id, { onDelete: "cascade" }), // Scoped to specific game
    assignedBy: varchar("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_user_roles_user").on(table.userId),
    index("idx_user_roles_role").on(table.roleId),
    index("idx_user_roles_field").on(table.fieldId),
    index("idx_user_roles_game").on(table.gameId),
  ]
);

// ============================================================================
// Admin Accounts table - Field-specific admin login (Firebase-based or legacy password)
// ============================================================================
export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    firebaseUserId: varchar("firebase_user_id", { length: 255 }), // Link to Firebase user for SSO login
    clerkUserId: varchar("clerk_user_id", { length: 255 }), // DEPRECATED: Legacy Clerk user link, kept for data migration only
    username: varchar("username", { length: 100 }), // Optional for legacy password auth
    passwordHash: varchar("password_hash", { length: 255 }), // Optional for legacy password auth
    displayName: varchar("display_name", { length: 100 }),
    email: varchar("email"),
    roleId: varchar("role_id").references(() => roles.id),
    status: varchar("status", { length: 20 }).default("active"), // active, inactive, locked
    failedLoginAttempts: integer("failed_login_attempts").default(0),
    lastLoginAt: timestamp("last_login_at"),
    lastLoginIp: varchar("last_login_ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_admin_accounts_field").on(table.fieldId),
    index("idx_admin_accounts_username").on(table.fieldId, table.username),
    index("idx_admin_accounts_clerk").on(table.clerkUserId),
    index("idx_admin_accounts_firebase").on(table.firebaseUserId),
  ]
);

// ============================================================================
// Admin Sessions table - JWT session tracking
// ============================================================================
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    adminAccountId: varchar("admin_account_id")
      .references(() => adminAccounts.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 500 }).unique().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_admin_sessions_token").on(table.token),
    index("idx_admin_sessions_expires").on(table.expiresAt),
  ]
);

// ============================================================================
// Audit Logs table - Track admin actions
// ============================================================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorUserId: varchar("actor_user_id").references(() => users.id), // Firebase user
    actorAdminId: varchar("actor_admin_id").references(() => adminAccounts.id), // Admin account
    action: varchar("action", { length: 100 }).notNull(), // e.g., "game:create", "user:update_role"
    targetType: varchar("target_type", { length: 50 }), // game, user, device, session, field
    targetId: varchar("target_id"),
    fieldId: varchar("field_id").references(() => fields.id),
    metadata: jsonb("metadata").default({}), // Additional action details
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_actor_user").on(table.actorUserId),
    index("idx_audit_logs_actor_admin").on(table.actorAdminId),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_target").on(table.targetType, table.targetId),
    index("idx_audit_logs_field").on(table.fieldId),
    index("idx_audit_logs_created").on(table.createdAt),
  ]
);

// ============================================================================
// Users table - Required for Replit Auth
// ============================================================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).default("player"), // player, admin, creator (legacy - use userRoles for new RBAC)
  defaultFieldId: varchar("default_field_id").references(() => fields.id), // Default field for multi-field users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  gameSessions: many(gameSessions),
  playerProgress: many(playerProgress),
  chatMessages: many(chatMessages),
  shootingRecords: many(shootingRecords),
  createdGames: many(games),
}));

// ============================================================================
// Games table - Main game definitions
// ============================================================================
// Game mode enum
export const gameModeEnum = ["individual", "team"] as const;
export type GameMode = typeof gameModeEnum[number];

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"), // easy, medium, hard
  estimatedTime: integer("estimated_time"), // minutes
  maxPlayers: integer("max_players").default(6),
  status: varchar("status", { length: 20 }).default("draft"), // draft, published, archived
  creatorId: varchar("creator_id").references(() => users.id),
  // Field association - each game belongs to a field/venue
  fieldId: varchar("field_id").references(() => fields.id, { onDelete: "set null" }),
  // Unique public slug for game isolation
  publicSlug: varchar("public_slug", { length: 100 }).unique(), // e.g., "abc123" for /g/abc123
  qrCodeUrl: text("qr_code_url"), // Stored QR code image path
  isIsolated: boolean("is_isolated").default(true), // When true, game only accessible via direct link
  // Location lock settings - require players to be at specific GPS location to start
  locationLockEnabled: boolean("location_lock_enabled").default(false),
  lockLatitude: decimal("lock_latitude", { precision: 10, scale: 8 }),
  lockLongitude: decimal("lock_longitude", { precision: 11, scale: 8 }),
  lockRadius: integer("lock_radius").default(50), // meters
  lockLocationName: varchar("lock_location_name", { length: 200 }),
  // Game mode settings - individual or team
  gameMode: varchar("game_mode", { length: 20 }).default("individual"), // individual, team
  minTeamPlayers: integer("min_team_players").default(2), // Minimum players required for team mode
  maxTeamPlayers: integer("max_team_players").default(6), // Maximum players allowed in a team
  enableTeamChat: boolean("enable_team_chat").default(true), // Allow text chat between team members
  enableTeamVoice: boolean("enable_team_voice").default(false), // Allow voice chat between team members
  enableTeamLocation: boolean("enable_team_location").default(true), // Show team members on map
  teamScoreMode: varchar("team_score_mode", { length: 20 }).default("shared"), // shared, individual, hybrid
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gamesRelations = relations(games, ({ one, many }) => ({
  creator: one(users, {
    fields: [games.creatorId],
    references: [users.id],
  }),
  field: one(fields, {
    fields: [games.fieldId],
    references: [fields.id],
  }),
  pages: many(pages),
  items: many(items),
  events: many(events),
  gameSessions: many(gameSessions),
  leaderboard: many(leaderboard),
}));

// ============================================================================
// Field Relations
// ============================================================================
export const fieldsRelations = relations(fields, ({ many }) => ({
  games: many(games),
  roles: many(roles),
  adminAccounts: many(adminAccounts),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  field: one(fields, {
    fields: [roles.fieldId],
    references: [fields.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
  adminAccounts: many(adminAccounts),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  field: one(fields, {
    fields: [userRoles.fieldId],
    references: [fields.id],
  }),
  game: one(games, {
    fields: [userRoles.gameId],
    references: [games.id],
  }),
}));

export const adminAccountsRelations = relations(adminAccounts, ({ one, many }) => ({
  field: one(fields, {
    fields: [adminAccounts.fieldId],
    references: [fields.id],
  }),
  role: one(roles, {
    fields: [adminAccounts.roleId],
    references: [roles.id],
  }),
  sessions: many(adminSessions),
  auditLogs: many(auditLogs),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminAccount: one(adminAccounts, {
    fields: [adminSessions.adminAccountId],
    references: [adminAccounts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  actorAdmin: one(adminAccounts, {
    fields: [auditLogs.actorAdminId],
    references: [adminAccounts.id],
  }),
  field: one(fields, {
    fields: [auditLogs.fieldId],
    references: [fields.id],
  }),
}));

// ============================================================================
// Pages table - Game page/scene definitions
// ============================================================================
export const pages = pgTable(
  "pages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    pageOrder: integer("page_order").notNull(),
    pageType: varchar("page_type", { length: 50 }).notNull(), // text_card, dialogue, video, button, text_verify, choice_verify, conditional_verify, shooting_mission, photo_mission, gps_mission, qr_scan, arduino_sensor
    config: jsonb("config").notNull(), // Page-specific configuration
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pages_game_id").on(table.gameId),
    index("idx_pages_order").on(table.gameId, table.pageOrder),
  ]
);

export const pagesRelations = relations(pages, ({ one }) => ({
  game: one(games, {
    fields: [pages.gameId],
    references: [games.id],
  }),
}));

// ============================================================================
// Items table - Game items/equipment
// ============================================================================
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  itemType: varchar("item_type", { length: 50 }), // consumable, equipment, quest_item, collectible
  effect: jsonb("effect"), // Item effect configuration
  createdAt: timestamp("created_at").defaultNow(),
});

export const itemsRelations = relations(items, ({ one }) => ({
  game: one(games, {
    fields: [items.gameId],
    references: [games.id],
  }),
}));

// ============================================================================
// Events table - Search/trigger events
// ============================================================================
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // qrcode, gps, photo, arduino
  triggerConfig: jsonb("trigger_config").notNull(), // Trigger conditions
  rewardConfig: jsonb("reward_config"), // Reward configuration
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventsRelations = relations(events, ({ one }) => ({
  game: one(games, {
    fields: [events.gameId],
    references: [games.id],
  }),
}));

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
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_sessions_status").on(table.status, table.startedAt)]
);

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  game: one(games, {
    fields: [gameSessions.gameId],
    references: [games.id],
  }),
  playerProgress: many(playerProgress),
  chatMessages: many(chatMessages),
  shootingRecords: many(shootingRecords),
}));

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

export const playerProgressRelations = relations(playerProgress, ({ one }) => ({
  session: one(gameSessions, {
    fields: [playerProgress.sessionId],
    references: [gameSessions.id],
  }),
  user: one(users, {
    fields: [playerProgress.userId],
    references: [users.id],
  }),
  currentPage: one(pages, {
    fields: [playerProgress.currentPageId],
    references: [pages.id],
  }),
}));

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

export const teamsRelations = relations(teams, ({ one, many }) => ({
  game: one(games, {
    fields: [teams.gameId],
    references: [games.id],
  }),
  leader: one(users, {
    fields: [teams.leaderId],
    references: [users.id],
  }),
  members: many(teamMembers),
  session: many(teamSessions),
  votes: many(teamVotes),
  scoreHistory: many(teamScoreHistory),
}));

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

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

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

export const teamSessionsRelations = relations(teamSessions, ({ one }) => ({
  team: one(teams, {
    fields: [teamSessions.teamId],
    references: [teams.id],
  }),
  session: one(gameSessions, {
    fields: [teamSessions.sessionId],
    references: [gameSessions.id],
  }),
  currentPage: one(pages, {
    fields: [teamSessions.currentPageId],
    references: [pages.id],
  }),
}));

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

export const teamVotesRelations = relations(teamVotes, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamVotes.teamId],
    references: [teams.id],
  }),
  page: one(pages, {
    fields: [teamVotes.pageId],
    references: [pages.id],
  }),
  ballots: many(teamVoteBallots),
}));

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

export const teamVoteBallotsRelations = relations(teamVoteBallots, ({ one }) => ({
  vote: one(teamVotes, {
    fields: [teamVoteBallots.voteId],
    references: [teamVotes.id],
  }),
  user: one(users, {
    fields: [teamVoteBallots.userId],
    references: [users.id],
  }),
}));

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

export const teamScoreHistoryRelations = relations(teamScoreHistory, ({ one }) => ({
  team: one(teams, {
    fields: [teamScoreHistory.teamId],
    references: [teams.id],
  }),
}));

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

export const randomEventsRelations = relations(randomEvents, ({ one, many }) => ({
  game: one(games, {
    fields: [randomEvents.gameId],
    references: [games.id],
  }),
  occurrences: many(randomEventOccurrences),
}));

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

export const randomEventOccurrencesRelations = relations(randomEventOccurrences, ({ one }) => ({
  event: one(randomEvents, {
    fields: [randomEventOccurrences.eventId],
    references: [randomEvents.id],
  }),
  session: one(gameSessions, {
    fields: [randomEventOccurrences.sessionId],
    references: [gameSessions.id],
  }),
  team: one(teams, {
    fields: [randomEventOccurrences.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [randomEventOccurrences.userId],
    references: [users.id],
  }),
}));

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

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(gameSessions, {
    fields: [chatMessages.sessionId],
    references: [gameSessions.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// Arduino Devices table - IoT device registry
// ============================================================================
export const arduinoDevices = pgTable("arduino_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id", { length: 50 }).unique(), // Hardware device unique ID (e.g., TARGET_001)
  deviceName: varchar("device_name", { length: 100 }).notNull(),
  deviceType: varchar("device_type", { length: 50 }).default("shooting_target"), // shooting_target, sensor, trigger, display, controller
  mqttTopic: varchar("mqtt_topic", { length: 200 }).unique(),
  location: varchar("location", { length: 100 }), // Human-readable location description
  locationLat: decimal("location_lat", { precision: 10, scale: 8 }),
  locationLng: decimal("location_lng", { precision: 11, scale: 8 }),
  status: varchar("status", { length: 20 }).default("offline"), // online, offline, error, maintenance
  lastHeartbeat: timestamp("last_heartbeat"),
  batteryLevel: integer("battery_level"), // Percentage 0-100
  firmwareVersion: varchar("firmware_version", { length: 20 }),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6 address
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const arduinoDevicesRelations = relations(arduinoDevices, ({ many }) => ({
  shootingRecords: many(shootingRecords),
  deviceLogs: many(deviceLogs),
}));

// ============================================================================
// Device Logs table - Device activity and error logs
// ============================================================================
export const deviceLogs = pgTable(
  "device_logs",
  {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 50 }).notNull(), // References arduinoDevices.deviceId
    logType: varchar("log_type", { length: 20 }).notNull(), // info, warning, error, debug
    message: text("message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_device_logs_device").on(table.deviceId, table.createdAt),
  ]
);

export const deviceLogsRelations = relations(deviceLogs, ({ one }) => ({
  device: one(arduinoDevices, {
    fields: [deviceLogs.deviceId],
    references: [arduinoDevices.deviceId],
  }),
}));

// ============================================================================
// Shooting Records table - Shooting target hits
// ============================================================================
export const shootingRecords = pgTable(
  "shooting_records",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id").references(() => gameSessions.id),
    deviceId: varchar("device_id"), // References arduinoDevices.deviceId (hardware ID)
    gameSessionId: integer("game_session_id"), // Optional legacy field
    userId: varchar("user_id").references(() => users.id),
    targetZone: varchar("target_zone", { length: 20 }), // center, inner, outer
    hitScore: integer("hit_score"),
    hitPosition: varchar("hit_position", { length: 50 }), // bullseye, inner, outer
    score: integer("score"), // Alternative score field for compatibility
    hitTimestamp: timestamp("hit_timestamp").defaultNow(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_shooting_records_session").on(table.sessionId),
    index("idx_shooting_records_device").on(table.deviceId),
    index("idx_shooting_records_timestamp").on(table.hitTimestamp),
  ]
);

export const shootingRecordsRelations = relations(shootingRecords, ({ one }) => ({
  session: one(gameSessions, {
    fields: [shootingRecords.sessionId],
    references: [gameSessions.id],
  }),
  device: one(arduinoDevices, {
    fields: [shootingRecords.deviceId],
    references: [arduinoDevices.id],
  }),
  user: one(users, {
    fields: [shootingRecords.userId],
    references: [users.id],
  }),
}));

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

export const leaderboardRelations = relations(leaderboard, ({ one }) => ({
  game: one(games, {
    fields: [leaderboard.gameId],
    references: [games.id],
  }),
  session: one(gameSessions, {
    fields: [leaderboard.sessionId],
    references: [gameSessions.id],
  }),
}));

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

export const locationsRelations = relations(locations, ({ one, many }) => ({
  game: one(games, {
    fields: [locations.gameId],
    references: [games.id],
  }),
  visits: many(locationVisits),
}));

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

export const playerLocationsRelations = relations(playerLocations, ({ one }) => ({
  session: one(gameSessions, {
    fields: [playerLocations.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(users, {
    fields: [playerLocations.playerId],
    references: [users.id],
  }),
}));

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

export const locationVisitsRelations = relations(locationVisits, ({ one }) => ({
  location: one(locations, {
    fields: [locationVisits.locationId],
    references: [locations.id],
  }),
  session: one(gameSessions, {
    fields: [locationVisits.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(users, {
    fields: [locationVisits.playerId],
    references: [users.id],
  }),
}));

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

export const navigationPathsRelations = relations(navigationPaths, ({ one }) => ({
  game: one(games, {
    fields: [navigationPaths.gameId],
    references: [games.id],
  }),
}));

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

export const achievementsRelations = relations(achievements, ({ one, many }) => ({
  game: one(games, {
    fields: [achievements.gameId],
    references: [games.id],
  }),
  playerAchievements: many(playerAchievements),
}));

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

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  achievement: one(achievements, {
    fields: [playerAchievements.achievementId],
    references: [achievements.id],
  }),
  user: one(users, {
    fields: [playerAchievements.userId],
    references: [users.id],
  }),
  session: one(gameSessions, {
    fields: [playerAchievements.gameSessionId],
    references: [gameSessions.id],
  }),
}));

// ============================================================================
// Zod Schemas for validation
// ============================================================================

// Field schemas
export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fields.$inferSelect;

// Role schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Permission schemas
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

// Role Permission schemas
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// User Role schemas
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// Admin Account schemas
export const insertAdminAccountSchema = createInsertSchema(adminAccounts).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminAccount = z.infer<typeof insertAdminAccountSchema>;
export type AdminAccount = typeof adminAccounts.$inferSelect;

// Admin Session schemas
export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;

// Audit Log schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Game schemas
export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Page schemas
export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
});
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;

// Page config types for different page types
export interface TextCardConfig {
  title: string;
  content: string;
  backgroundImage?: string;
  textColor?: string;
  fontSize?: "small" | "medium" | "large";
  animation?: "fade_in" | "slide_in" | "none";
  // Enhanced features
  layout?: "center" | "image_top" | "image_left" | "fullscreen";
  typewriterEffect?: boolean;
  typewriterSpeed?: number; // ms per character
  backgroundAudio?: string; // audio URL
  timeLimit?: number; // seconds, auto-advance after time
  highlightKeywords?: string[]; // words to highlight in content
  locationSettings?: LocationSettings;
}

export interface DialogueMessage {
  text: string;
  delay?: number;
  emotion?: "neutral" | "happy" | "angry" | "surprised" | "sad" | "thinking";
}

export interface DialogueConfig {
  character: {
    name: string;
    avatar?: string;
    emotionAvatars?: {
      neutral?: string;
      happy?: string;
      angry?: string;
      surprised?: string;
      sad?: string;
      thinking?: string;
    };
  };
  messages: DialogueMessage[];
  autoAdvance?: boolean;
  showEmotionIndicator?: boolean;
  bubbleAnimation?: boolean;
  locationSettings?: LocationSettings;
}

export interface VideoConfig {
  videoUrl: string;
  autoPlay?: boolean;
  skipEnabled?: boolean;
  locationSettings?: LocationSettings;
}

export interface ButtonConfig {
  prompt?: string;
  buttons: Array<{
    text: string;
    icon?: string;
    nextPageId?: string;
    rewardPoints?: number;
    items?: string[];
    color?: string;
  }>;
  // Enhanced features
  timeLimit?: number; // seconds for countdown
  defaultChoice?: number; // index of default button when time runs out
  randomizeOrder?: boolean;
  showStatistics?: boolean; // show "60% chose this"
  locationSettings?: LocationSettings;
}

export interface TextVerifyConfig {
  title?: string;
  question: string;
  hint?: string;
  answers?: string[];
  correctAnswer?: string;
  caseSensitive?: boolean;
  hints?: string[];
  maxAttempts?: number;
  successMessage?: string;
  failureMessage?: string;
  nextPageId?: string;
  onSuccess?: {
    message?: string;
    grantItem?: string;
    unlockContent?: string;
  };
  // Enhanced features
  showAttemptHistory?: boolean;
  gradedFeedback?: boolean; // "很接近了!" vs "完全不對"
  inputType?: "text" | "number" | "password";
  showExplanation?: boolean;
  explanation?: string;
  locationSettings?: LocationSettings;
}

export interface ChoiceVerifyConfig {
  title?: string;
  question?: string;
  options?: Array<{
    text: string;
    correct?: boolean;
    nextPageId?: string;
    explanation?: string;
  }>;
  questions?: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
  multiple?: boolean;
  passingScore?: number;
  onSuccess?: {
    message?: string;
    grantItem?: string;
  };
  // Enhanced features
  timeLimit?: number;
  randomizeOptions?: boolean;
  showExplanation?: boolean;
  partialCredit?: boolean;
}

// ============================================================================
// Unified Location Settings - 統一的GPS定位設置，可用於所有頁面組件
// ============================================================================
export interface LocationSettings {
  enabled: boolean;           // 是否啟用地圖標記
  latitude?: number;          // 緯度
  longitude?: number;         // 經度
  radius?: number;            // 觸發範圍（米）
  locationName?: string;      // 地點名稱
  instructions?: string;      // 導航指示
  showOnMap?: boolean;        // 是否在地圖上顯示
  iconType?: 'default' | 'qr' | 'photo' | 'shooting' | 'gps' | 'puzzle' | 'star'; // 地圖圖標類型
}

// ============================================================================
// Fragment Collection Config - 碎片收集器配置（重新設計的 conditional_verify）
// ============================================================================
export interface FragmentConfig {
  id: string;                 // 碎片唯一ID
  label: string;              // 碎片標籤（如 "碎片 1/5"）
  value: string;              // 碎片值（如 "19", "58", "A", "B"）
  sourceItemId?: string;      // 關聯的道具ID（可選）
  order?: number;             // 順序（用於排序驗證）
}

export interface FragmentCollectionConfig {
  title?: string;
  instruction?: string;
  description?: string;
  
  // 碎片類型設置
  fragmentType: 'numbers' | 'letters' | 'custom';  // 碎片類型
  fragmentCount: number;                           // 碎片數量
  fragments: FragmentConfig[];                     // 碎片配置列表
  
  // 驗證設置
  targetCode?: string;                             // 目標組合代碼（自動計算或手動設定）
  verificationMode: 'order_matters' | 'order_independent' | 'all_collected';
  
  // 條件設置（向後兼容舊版）
  conditions?: Array<{
    type: 'has_item' | 'has_points' | 'visited_location';
    itemId?: string;
    minPoints?: number;
    locationId?: string;
    description?: string;
  }>;
  allRequired?: boolean;      // 是否需要全部滿足
  
  // 結果處理
  successMessage?: string;
  failureMessage?: string;
  successNextPageId?: string;
  failureNextPageId?: string;
  onSuccess?: {
    message?: string;
    grantItem?: string;
    points?: number;
    unlockContent?: string;
  };
}

// Legacy support - 保留舊版接口兼容
export interface ConditionalVerifyConfig {
  title?: string;
  question?: string;
  conditions?: Array<{
    keywords?: string[];
    nextPageId?: string;
    type?: 'has_item' | 'has_points' | 'visited_location';
    itemId?: string;
    minPoints?: number;
    locationId?: string;
    description?: string;
  }>;
  allRequired?: boolean;
  defaultPageId?: string;
  successMessage?: string;
  failureMessage?: string;
  
  // 新版碎片收集器配置
  fragmentType?: 'numbers' | 'letters' | 'custom';
  fragmentCount?: number;
  fragments?: FragmentConfig[];
  targetCode?: string;
  verificationMode?: 'order_matters' | 'order_independent' | 'all_collected';
  onSuccess?: {
    message?: string;
    grantItem?: string;
    points?: number;
    unlockContent?: string;
  };
}

export interface ShootingMissionConfig {
  title?: string;
  description?: string;
  imageUrl?: string;
  targetDeviceId?: string;
  deviceId?: string;
  requiredHits?: number;
  timeLimit: number;
  minScore?: number;
  targetScore?: number;
  successReward?: {
    points: number;
    items?: string[];
  };
  onSuccess?: {
    message?: string;
    grantItem?: string;
  };
  locationSettings?: LocationSettings;
}

export interface PhotoMissionConfig {
  title?: string;
  description?: string;
  prompt?: string;
  imageUrl?: string;
  instruction?: string;
  aiVerify?: boolean;
  targetKeywords?: string[];
  manualVerify?: boolean;
  onSuccess?: {
    message?: string;
    grantItem?: string;
    points?: number;
  };
  locationSettings?: LocationSettings;
}

export interface GpsMissionConfig {
  title?: string;
  description?: string;
  imageUrl?: string;
  locationName?: string;
  targetLocation?: {
    lat: number;
    lng: number;
  };
  targetLatitude?: number;
  targetLongitude?: number;
  radius?: number; // meters
  instruction?: string;
  onSuccess?: {
    message?: string;
    grantItem?: string;
    points?: number;
  };
  // Enhanced features
  hotZoneHints?: boolean; // "很近了!" "往右走"
  proximitySound?: boolean;
  showMap?: boolean;
  qrFallback?: boolean; // allow QR scan if GPS unavailable
  fallbackQrCode?: string;
  // GPS任務自動啟用地圖顯示，但也支持統一設置
  locationSettings?: LocationSettings;
}

export interface QrScanConfig {
  title?: string;
  description?: string;
  prompt?: string;
  imageUrl?: string;
  instruction?: string;
  locationHint?: string;
  successMessage?: string;
  nextPageId?: string;
  
  // QR 驗證設置 - 優化後的驗證邏輯
  validationMode?: 'exact' | 'case_insensitive' | 'location_id' | 'regex';
  primaryCode?: string;           // 主要驗證代碼
  alternativeCodes?: string[];    // 備用代碼（任一匹配即可）
  
  // 向後兼容舊字段
  qrCodeId?: string;              // 舊版：QR代碼ID
  expectedCode?: string;          // 舊版：期望代碼
  
  reward?: {
    points: number;
    items?: string[];
  };
  rewardPoints?: number;          // 獎勵積分
  rewardItems?: string[];         // 獎勵道具ID列表
  onSuccess?: {
    message?: string;
    grantItem?: string;
  };
  
  // 統一的定位設置
  locationSettings?: LocationSettings;
}

export interface ArduinoSensorConfig {
  deviceId: string;
  sensorType: "motion" | "rfid" | "pressure";
  triggerCondition: string;
  timeout?: number;
}

// New enhanced page types
export interface TimeBombConfig {
  title?: string;
  instruction?: string;
  timeLimit: number; // seconds
  tasks: Array<{
    type: "tap" | "swipe" | "input" | "choice";
    question?: string;
    answer?: string;
    options?: string[];
    correctIndex?: number;
    targetCount?: number; // for tap type
  }>;
  successMessage?: string;
  failureMessage?: string;
  successNextPageId?: string;
  failureNextPageId?: string;
  rewardPoints?: number;
}

export interface LockConfig {
  title?: string;
  instruction?: string;
  lockType: "number" | "letter" | "dial";
  combination: string;
  digits?: number;
  maxAttempts?: number;
  hint?: string;
  successMessage?: string;
  failureMessage?: string;
  nextPageId?: string;
  rewardPoints?: number;
}

export interface VoteConfig {
  title?: string;
  question: string;
  options: Array<{
    text: string;
    icon?: string;
    nextPageId?: string;
  }>;
  minVotes?: number;
  showResults?: boolean;
  anonymousVoting?: boolean;
  votingTimeLimit?: number;
}

export interface MotionChallengeConfig {
  title?: string;
  instruction?: string;
  challengeType: "shake" | "tilt" | "jump" | "rotate";
  targetValue: number; // e.g., shake count, tilt degrees
  timeLimit?: number;
  showProgress?: boolean;
  successMessage?: string;
  failureMessage?: string;
  nextPageId?: string;
  rewardPoints?: number;
}

export type PageConfig =
  | TextCardConfig
  | DialogueConfig
  | VideoConfig
  | ButtonConfig
  | TextVerifyConfig
  | ChoiceVerifyConfig
  | ConditionalVerifyConfig
  | ShootingMissionConfig
  | PhotoMissionConfig
  | GpsMissionConfig
  | QrScanConfig
  | ArduinoSensorConfig
  | TimeBombConfig
  | LockConfig
  | VoteConfig
  | MotionChallengeConfig;

// Item schemas
export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
});
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

// Event schemas
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type GameEvent = typeof events.$inferSelect;

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

// Arduino Device schemas
export const insertArduinoDeviceSchema = createInsertSchema(arduinoDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertArduinoDevice = z.infer<typeof insertArduinoDeviceSchema>;
export type ArduinoDevice = typeof arduinoDevices.$inferSelect;

// Device Log schemas
export const insertDeviceLogSchema = createInsertSchema(deviceLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertDeviceLog = z.infer<typeof insertDeviceLogSchema>;
export type DeviceLog = typeof deviceLogs.$inferSelect;

// Shooting Record schemas
export const insertShootingRecordSchema = createInsertSchema(shootingRecords).omit({
  id: true,
  timestamp: true,
});
export type InsertShootingRecord = z.infer<typeof insertShootingRecordSchema>;
export type ShootingRecord = typeof shootingRecords.$inferSelect;

// Leaderboard schemas
export const insertLeaderboardSchema = createInsertSchema(leaderboard).omit({
  id: true,
  createdAt: true,
});
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;

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

// Extended types for frontend use
export type GameWithPages = Game & {
  pages: Page[];
};

export type GameWithDetails = Game & {
  pages: Page[];
  items: Item[];
  events: GameEvent[];
  creator?: User;
};

export type GameSessionWithProgress = GameSession & {
  game?: Game;
  playerProgress: PlayerProgress[];
};

export type LeaderboardWithDetails = LeaderboardEntry & {
  game?: Game;
  session?: GameSession;
};

// Team extended types
export type TeamWithMembers = Team & {
  members: (TeamMember & { user?: User })[];
  leader?: User;
};

export type TeamWithSession = Team & {
  members: (TeamMember & { user?: User })[];
  session?: TeamSession;
  game?: Game;
};

export type TeamVoteWithBallots = TeamVote & {
  ballots: (TeamVoteBallot & { user?: User })[];
};
