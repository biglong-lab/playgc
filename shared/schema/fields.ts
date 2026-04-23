// 場域 (Fields) - 場域/場地管理
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
// FieldSettings — 場域設定介面（存於 fields.settings jsonb）
// ============================================================================

/**
 * 場域視覺主題設定（v2）
 *
 * 讓每個場域（如賈村、后浦小鎮）有獨立的視覺識別：
 * 顏色、版面、字體、底圖、Logo。
 *
 * 所有欄位都 optional — 缺少時 fallback 到系統預設。
 */
export interface FieldTheme {
  /** 顏色預設模式（暗色/亮色/自訂） */
  colorScheme?: "dark" | "light" | "custom";
  /** 主色（hex，如 #f97316） */
  primaryColor?: string;
  /** 輔色（按鈕、強調） */
  accentColor?: string;
  /** 背景色（整頁底色） */
  backgroundColor?: string;
  /** 主要文字色 */
  textColor?: string;
  /** 版面模板 id：
   *  - classic：目前的 header + 卡片網格
   *  - card：大尺寸卡片滑動瀏覽
   *  - fullscreen：每個遊戲滿版、滑動切換
   *  - minimal：純列表、極簡
   */
  layoutTemplate?: "classic" | "card" | "fullscreen" | "minimal";
  /** 場域封面圖片（hero/登入頁/遊戲列表頂部） */
  coverImageUrl?: string;
  /** 場域 Logo（覆蓋 fields.logoUrl，顯示於 header 左上） */
  brandingLogoUrl?: string;
  /** 字體風格 */
  fontFamily?: "default" | "serif" | "mono" | "display";
}

/**
 * 場域亮點 — 顯示於該場域 Landing 的 Feature Section
 * 每個場域可自訂 3-8 項，展示該場域的特色體驗
 */
export interface FieldHighlight {
  /** lucide icon name（例：Target / MapPin / Camera / Users / Swords / Puzzle / Landmark / Coffee） */
  icon?: string;
  /** 標題（例：射擊挑戰 / 歷史巡禮） */
  title: string;
  /** 描述（例：使用實體靶機進行射擊任務） */
  description?: string;
}

export interface FieldSettings {
  // AI 設定
  geminiApiKey?: string;              // AES-256-GCM 加密後的密文（支援 Gemini AIza... 或 OpenRouter sk-or-...）
  enableAI?: boolean;                 // AI 功能總開關
  aiVisionModel?: string;             // 照片驗證模型（OpenRouter 時用）
  aiTextModel?: string;               // 文字評分模型（OpenRouter 時用）

  // 配額
  maxGames?: number;                  // 最大遊戲數（0 或 undefined = 無限）
  maxConcurrentSessions?: number;     // 最大同時場次

  // 功能開關（通用）
  enablePayment?: boolean;            // 收費功能
  enableTeamMode?: boolean;           // 團隊模式
  enableCompetitiveMode?: boolean;    // 競賽/接力模式

  // 🆕 場域模組開關（決定該場域啟用哪些特殊功能模組）
  // 預設 false — 新場域要明確啟用才有該模組，避免 CHITO 平台首頁誤推銷場域沒有的功能
  enableShootingMission?: boolean;    // 射擊任務（硬體靶機）— 僅有硬體靶機的場域
  enableBattleArena?: boolean;        // 水彈對戰 PK 擂台 — 僅有對戰場地的場域
  enableChapters?: boolean;           // 章節制遊戲
  enablePhotoMission?: boolean;       // 拍照驗證任務
  enableGpsMission?: boolean;         // GPS 定位任務

  // 🆕 場域行銷內容 — 顯示於該場域 Landing 和 CHITO 平台首頁的場域卡
  tagline?: string;                   // 短 slogan（例：金門戰地文化沉浸體驗）
  highlights?: FieldHighlight[];      // 場域亮點（Landing Feature Section 用）
  /** 🆕 場域公告 — 顯示於 Landing Hero 下方和 Home header 下方（空字串/undefined = 不顯示）*/
  announcement?: string;

  // 品牌（legacy — 僅 primaryColor 保留向後相容；推薦改用 theme.primaryColor）
  primaryColor?: string;              // @deprecated 改用 theme.primaryColor
  welcomeMessage?: string;            // 歡迎訊息

  // 🆕 視覺主題（v2）— 完整視覺識別
  theme?: FieldTheme;

  // 遊戲預設設定
  defaultGameTime?: number;           // 預設遊戲時間（分鐘）
  defaultMaxPlayers?: number;         // 預設最大玩家數

  // 場次管理設定
  autoEndIdleSession?: boolean;       // 自動結束閒置場次
  sessionIdleTimeout?: number;        // 閒置超時時間（分鐘）
}

/**
 * 從 FieldSettings 取出主題設定，自動處理向後相容：
 * - 優先用 settings.theme.primaryColor
 * - fallback 到 settings.primaryColor（legacy）
 */
export function resolveFieldTheme(settings: FieldSettings): FieldTheme {
  const theme = settings.theme || {};
  return {
    ...theme,
    primaryColor: theme.primaryColor || settings.primaryColor,
    layoutTemplate: theme.layoutTemplate || "classic",
  };
}

/** 安全解析 jsonb 為 FieldSettings，無效資料回傳空物件 */
export function parseFieldSettings(raw: unknown): FieldSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldSettings;
}

// Field schemas
export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fields.$inferSelect;
