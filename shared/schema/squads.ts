// Squad 系統 schema — 跨遊戲統一隊伍 + 戰績紀錄
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §20
import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// 0. squads — 隊伍本體（Phase 14 真正合併 Squad 主表）
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §20.1
//
// 取代：teams（一般遊戲）/ battle_clans（水彈）/ battle_premade_groups
//
// Phase 14 過渡期：
//   - 新建立的 Squad 走這張表
//   - 舊資料（battle_clans）暫保留，stat 紀錄用 battle_clans.id 當 squadId
//   - Phase 15 才做完整資料遷移
// ============================================================================
export const squads = pgTable("squads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(),
  tag: varchar("tag", { length: 10 }).notNull(),
  description: text("description"),
  emblemUrl: varchar("emblem_url"),
  primaryColor: varchar("primary_color", { length: 7 }), // HEX e.g. #be723c
  leaderId: varchar("leader_id").notNull(),       // references users.id
  homeFieldId: varchar("home_field_id"),           // 主場域（可空，跨平台型）
  isPublic: boolean("is_public").default(true).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  // 'active' / 'dormant' / 'pending_dissolve' / 'dissolved'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  dissolvedAt: timestamp("dissolved_at"),
  /** 改名冷卻（與 battle_clans.name_changed_at 相同邏輯）*/
  nameChangedAt: timestamp("name_changed_at"),
}, (table) => [
  unique("uq_squad_name").on(table.name),
  unique("uq_squad_tag").on(table.tag),
  index("idx_squad_leader").on(table.leaderId),
  index("idx_squad_field").on(table.homeFieldId),
  index("idx_squad_status").on(table.status),
]);

export const insertSquadSchema = createInsertSchema(squads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  dissolvedAt: true,
});

export type Squad = typeof squads.$inferSelect;
export type InsertSquad = typeof squads.$inferInsert;

// ============================================================================
// 0.5. squad_members — 隊伍成員
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §20.2
//
// 角色：leader / officer / member
// soft delete via leftAt（避免 unique 衝突）
// ============================================================================
export const squadMembers = pgTable("squad_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  squadId: varchar("squad_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
  /** 加入來源 — 區分自願加入 / 推廣連結 / admin 加入 */
  joinSource: varchar("join_source", { length: 20 }).default("self"),
  /** 對應的 invite token（從推廣連結進來才有）*/
  inviteId: varchar("invite_id"),
}, (table) => [
  index("idx_member_squad").on(table.squadId, table.role),
  index("idx_member_user").on(table.userId, table.leftAt),
]);

export type SquadMember = typeof squadMembers.$inferSelect;
export type InsertSquadMember = typeof squadMembers.$inferInsert;

// ============================================================================
// 1. squad_match_records — 每場戰績紀錄（跨遊戲統一格式）
// ============================================================================
//
// 來源：
//   - 一般遊戲 session 完成時寫入
//   - 水彈對戰結算時寫入
//   - 競技 / 接力 match 結束寫入
//   - 純體驗活動完成寫入
//
// 用途：
//   - 場次榜統計（跨遊戲總場次）
//   - 各遊戲段位 rating 變動
//   - 體驗點數累積
//   - 後續觸發獎勵轉換規則
// ============================================================================
export const squadMatchRecords = pgTable("squad_match_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // 隊伍識別（短期：對應現有 teams.id 或 battle_clans.id）
  // Phase 3 階段 squad_id 可指向 team / clan / premade_group 任一個
  // Phase 5 統合後 squad_id 才指向真正 squads.id
  squadId: varchar("squad_id").notNull(),
  squadType: varchar("squad_type", { length: 20 }).notNull(), // 'team' / 'clan' / 'premade_group' / 'squad'

  // 遊戲識別
  gameType: varchar("game_type", { length: 50 }).notNull(),
  // 'battle' (水彈) / 'adventure' (一般遊戲) / 'competitive' / 'relay' /
  // 'puzzle' (解謎) / 'experience' (純體驗) / 'cooperative' / 'personal_challenge'

  gameId: varchar("game_id"),       // 一般遊戲（games.id）
  slotId: varchar("slot_id"),       // 水彈時段（battle_slots.id）
  matchId: varchar("match_id"),     // 競技 match（matches.id）
  sessionId: varchar("session_id"), // game session（sessions.id）

  // 場域（用於場次榜跨域計算）
  fieldId: varchar("field_id").notNull(),

  // 結果
  result: varchar("result", { length: 20 }).notNull(),
  // 'win' / 'loss' / 'draw' / 'completed' / 'failed' / 'participated' / 'achieved'

  // 分數變動（各遊戲類型獨立累積）
  ratingBefore: integer("rating_before"),
  ratingAfter: integer("rating_after"),
  ratingChange: integer("rating_change").default(0),

  // 體驗點數變動（純體驗 / 合作模式用）
  expPoints: integer("exp_points").default(0),

  // 場次倍率（跨域 1.2 / 首航 2.0 / 主場 1.0）
  gameCountMultiplier: integer("game_count_multiplier").default(100), // 用 *100 整數儲存（120 = 1.2）

  // 表現指標（各遊戲類型自訂結構）
  performance: jsonb("performance").default(sql`'{}'::jsonb`),
  // 範例：
  //   battle: { duration, eliminations, deaths, isMvp, hits }
  //   adventure: { completionRate, duration, hintsUsed, totalSteps, completedSteps }
  //   competitive: { rank, totalParticipants, finishTime }
  //   experience: { duration, photoCount, memberCount }

  // 場域屬性（跨域加成判斷用）
  isCrossField: boolean("is_cross_field").default(false),
  isFirstVisit: boolean("is_first_visit").default(false),

  // 時間
  playedAt: timestamp("played_at").defaultNow().notNull(),
  durationSec: integer("duration_sec"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_squad_records_squad_played").on(table.squadId, table.playedAt.desc()),
  index("idx_squad_records_game_type").on(table.gameType),
  index("idx_squad_records_field").on(table.fieldId, table.playedAt.desc()),
  index("idx_squad_records_session").on(table.sessionId),
]);

export const insertSquadMatchRecordSchema = createInsertSchema(squadMatchRecords).omit({
  id: true,
  createdAt: true,
});

export type SquadMatchRecord = typeof squadMatchRecords.$inferSelect;
export type InsertSquadMatchRecord = typeof squadMatchRecords.$inferInsert;

// ============================================================================
// 2. squad_ratings — 各遊戲類型獨立 rating（每隊每類型一筆）
// ============================================================================
//
// 為什麼分開：水彈高手 ≠ 冒險高手，rating 不混算
// 起始：1200 分（白銀）
// ============================================================================
export const squadRatings = pgTable("squad_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  squadId: varchar("squad_id").notNull(),
  squadType: varchar("squad_type", { length: 20 }).notNull(),
  gameType: varchar("game_type", { length: 50 }).notNull(),

  rating: integer("rating").default(1200).notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),

  // 段位（自動推算）：bronze / silver / gold / platinum / master
  tier: varchar("tier", { length: 20 }).default("silver"),

  // 連勝/連敗
  winStreak: integer("win_streak").default(0),
  bestWinStreak: integer("best_win_streak").default(0),

  // 最高 rating（榮譽展示）
  peakRating: integer("peak_rating").default(1200),

  lastPlayedAt: timestamp("last_played_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_squad_rating_per_game").on(table.squadId, table.gameType),
  index("idx_squad_rating_lookup").on(table.gameType, table.rating.desc()),
]);

export const insertSquadRatingSchema = createInsertSchema(squadRatings).omit({
  id: true,
  updatedAt: true,
});

export type SquadRating = typeof squadRatings.$inferSelect;
export type InsertSquadRating = typeof squadRatings.$inferInsert;

// ============================================================================
// 3. squad_stats — 聚合戰績（每隊一筆，定期或即時更新）
// ============================================================================
//
// 場次榜、新人榜、上升星榜的主資料來源
// 跨遊戲類型聚合（rating 不聚合，但場次/體驗點/場域聚合）
// ============================================================================
export const squadStats = pgTable("squad_stats", {
  squadId: varchar("squad_id").primaryKey(),
  squadType: varchar("squad_type", { length: 20 }).notNull(),

  // 跨遊戲總場次（含跨域加成）
  totalGames: integer("total_games").default(0).notNull(),
  totalGamesRaw: integer("total_games_raw").default(0).notNull(), // 不含加成的原始場次

  // 跨遊戲累計
  totalWins: integer("total_wins").default(0).notNull(),
  totalLosses: integer("total_losses").default(0).notNull(),
  totalDraws: integer("total_draws").default(0).notNull(),
  totalExpPoints: integer("total_exp_points").default(0).notNull(),

  // 場域多樣性（[fieldId, fieldId, ...]）
  fieldsPlayed: jsonb("fields_played").default(sql`'[]'::jsonb`),

  // 招募
  recruitsCount: integer("recruits_count").default(0).notNull(),

  // 30 天統計（給上升星榜用，cron 每日更新）
  monthlyGames: integer("monthly_games").default(0),
  monthlyRecruits: integer("monthly_recruits").default(0),

  // 超級隊長段位
  superLeaderTier: varchar("super_leader_tier", { length: 20 }), // bronze/silver/gold/platinum/super

  // 隊伍狀態（生命週期）
  squadStatus: varchar("squad_status", { length: 20 }).default("active"),
  // 'active' / 'dormant' (30+ 天無活動) / 'pending_dissolve' / 'dissolved'

  // 時間戳
  firstActiveAt: timestamp("first_active_at"),
  lastActiveAt: timestamp("last_active_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_squad_stats_total_games").on(table.totalGames.desc()),
  index("idx_squad_stats_monthly").on(table.monthlyGames.desc()),
  index("idx_squad_stats_status").on(table.squadStatus),
]);

export const insertSquadStatsSchema = createInsertSchema(squadStats).omit({
  updatedAt: true,
});

export type SquadStats = typeof squadStats.$inferSelect;
export type InsertSquadStats = typeof squadStats.$inferInsert;

// ============================================================================
// Zod 驗證 — 各遊戲類型的 performance 結構
// ============================================================================
export const battlePerformanceSchema = z.object({
  duration: z.number().int().min(0),
  eliminations: z.number().int().min(0).optional(),
  deaths: z.number().int().min(0).optional(),
  isMvp: z.boolean().optional(),
  hits: z.number().int().min(0).optional(),
});

export const adventurePerformanceSchema = z.object({
  duration: z.number().int().min(0),
  completionRate: z.number().min(0).max(1),
  hintsUsed: z.number().int().min(0).optional(),
  totalSteps: z.number().int().min(0).optional(),
  completedSteps: z.number().int().min(0).optional(),
});

export const competitivePerformanceSchema = z.object({
  duration: z.number().int().min(0),
  rank: z.number().int().min(1),
  totalParticipants: z.number().int().min(2),
  finishTime: z.number().int().min(0).optional(),
});

export const experiencePerformanceSchema = z.object({
  duration: z.number().int().min(0),
  photoCount: z.number().int().min(0).optional(),
  memberCount: z.number().int().min(1).optional(),
});

// 統一 GameResult 列舉（與設計文件 §10.1 對齊）
export const gameResultEnum = [
  "win",          // PvP 贏
  "loss",         // PvP 輸
  "draw",         // PvP 平手
  "completed",    // PvE 完成
  "failed",       // PvE 失敗
  "participated", // 純體驗（無勝負）
  "achieved",     // 個人挑戰突破
] as const;
export type GameResult = typeof gameResultEnum[number];

// 統一 GameType 列舉（對應 5 種計分模式）
export const squadGameTypeEnum = [
  "battle",            // 水彈對戰（Mode A: PvP）
  "adventure",         // 一般冒險遊戲（Mode B: PvE）
  "competitive",       // 競技通關（Mode A: 名次）
  "relay",             // 接力賽（Mode A: 名次）
  "puzzle",            // 解謎（Mode B: PvE）
  "experience",        // 純體驗（Mode C: 無勝負）
  "cooperative",       // 合作達成（Mode D）
  "personal_challenge", // 個人挑戰（Mode E）
] as const;
export type SquadGameType = typeof squadGameTypeEnum[number];

// Squad 計分模式（管理員建立遊戲時選擇 — 與 matches.scoringModeEnum 不同）
// matches.scoringModeEnum 是競技類專用，這個是 Squad 系統 5 種計分模式
export const squadScoringModeEnum = ["pvp", "pve", "experience", "coop", "personal"] as const;
export type SquadScoringMode = typeof squadScoringModeEnum[number];

// ============================================================================
// 4. squad_achievements — 隊伍徽章（reward engine 觸發時寫入）
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §9.2-9.5
//
// 觸發來源：
//   - 規則引擎發放（reward type = 'badge'）
//   - 自動成就（如「三城遠征」、「百戰隊伍」）
//   - admin 手動授予
// ============================================================================
export const squadAchievements = pgTable("squad_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  squadId: varchar("squad_id").notNull(),

  achievementKey: varchar("achievement_key", { length: 50 }).notNull(),
  // 'cross_field_3' / 'cross_field_5' / 'recruiter_master' /
  // 'hall_of_fame' / 'season_top10_winter_2026' / 'first_win' / ...

  category: varchar("category", { length: 30 }),
  // 'cross_field' / 'recruit' / 'milestone' / 'event' / 'special'

  displayName: varchar("display_name", { length: 100 }),
  description: varchar("description", { length: 200 }),
  iconUrl: varchar("icon_url"),

  // 觸發來源（追蹤用）
  sourceRuleId: varchar("source_rule_id"),       // 規則引擎觸發
  sourceEventId: varchar("source_event_id"),     // 對應 reward_conversion_event
  awardedBy: varchar("awarded_by"),              // admin 授予 → user id

  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_squad_achievement").on(table.squadId, table.achievementKey),
  index("idx_squad_achievements").on(table.squadId, table.unlockedAt.desc()),
]);

export const insertSquadAchievementSchema = createInsertSchema(squadAchievements).omit({
  id: true,
  unlockedAt: true,
});

export type SquadAchievement = typeof squadAchievements.$inferSelect;
export type InsertSquadAchievement = typeof squadAchievements.$inferInsert;

// ============================================================================
// 5. squad_invites — 超級隊長推廣連結追蹤
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4 §20.7
//
// 用途：
//   - 超級隊長產生專屬推廣 token（URL: /invite/squad/:token）
//   - 追蹤點擊數 / 轉換數 / 後續場次數
//   - 隊長 Dashboard 行銷效益看板
//   - 一般隊伍也可使用（招募獎勵 1× ；超級隊長 2×）
// ============================================================================
export const squadInvites = pgTable("squad_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  squadId: varchar("squad_id").notNull(),
  inviterUserId: varchar("inviter_user_id").notNull(), // 推薦人（隊長 / 副隊長）
  inviteToken: varchar("invite_token", { length: 32 }).notNull().unique(), // URL token

  // 被招募者資訊（加入後填入）
  inviteeUserId: varchar("invitee_user_id"),
  joinedAt: timestamp("joined_at"),
  firstGamePlayedAt: timestamp("first_game_played_at"),
  totalGamesPlayed: integer("total_games_played").default(0).notNull(),

  // 點擊追蹤
  clickCount: integer("click_count").default(0).notNull(),
  lastClickedAt: timestamp("last_clicked_at"),

  // 獎勵狀態（避免重複發放招募獎勵）
  rewardsIssued: boolean("rewards_issued").default(false).notNull(),

  // 過期時間（可選；NULL 表示不過期）
  expiresAt: timestamp("expires_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_invites_inviter").on(table.inviterUserId, table.createdAt.desc()),
  index("idx_invites_token").on(table.inviteToken),
  index("idx_invites_squad").on(table.squadId, table.createdAt.desc()),
  index("idx_invites_invitee").on(table.inviteeUserId),
]);

export const insertSquadInviteSchema = createInsertSchema(squadInvites).omit({
  id: true,
  createdAt: true,
  clickCount: true,
  totalGamesPlayed: true,
  rewardsIssued: true,
});

export type SquadInvite = typeof squadInvites.$inferSelect;
export type InsertSquadInvite = typeof squadInvites.$inferInsert;

// ============================================================================
// 6. squad_name_history — 隊名改名歷史
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §17.3
//
// 規則：
//   - 建立後 7 天內可改 1 次（防錯字）
//   - 之後每次改名間隔 30 天
//   - 歷史不可刪除（防止鑽漏洞）
// ============================================================================
export const squadNameHistory = pgTable("squad_name_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  squadId: varchar("squad_id").notNull(),
  oldName: varchar("old_name", { length: 50 }).notNull(),
  newName: varchar("new_name", { length: 50 }).notNull(),
  oldTag: varchar("old_tag", { length: 10 }),
  newTag: varchar("new_tag", { length: 10 }),
  changedByUserId: varchar("changed_by_user_id").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  reason: varchar("reason", { length: 200 }),
}, (table) => [
  index("idx_name_history_squad").on(table.squadId, table.changedAt.desc()),
]);

export type SquadNameHistory = typeof squadNameHistory.$inferSelect;
export type InsertSquadNameHistory = typeof squadNameHistory.$inferInsert;

// ============================================================================
// 7. squad_name_locks — 解散後鎖名
// ============================================================================
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §17.4
//
// 隊伍解散 → 隊名鎖 180 天
// 防止惡意搶名 / 釣魚
// ============================================================================
export const squadNameLocks = pgTable("squad_name_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(),
  tag: varchar("tag", { length: 10 }),
  fieldId: varchar("field_id"),
  lockedUntil: timestamp("locked_until").notNull(),
  reason: varchar("reason", { length: 50 }).default("dissolved"),
  originalSquadId: varchar("original_squad_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_name_locks_name").on(table.name, table.lockedUntil),
  index("idx_name_locks_field").on(table.fieldId),
]);

export type SquadNameLock = typeof squadNameLocks.$inferSelect;
export type InsertSquadNameLock = typeof squadNameLocks.$inferInsert;
