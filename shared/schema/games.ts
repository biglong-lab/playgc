// 遊戲核心 (Games) - 遊戲定義、頁面、道具、事件
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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { fields } from "./fields";

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

