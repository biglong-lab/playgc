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
  // 🆕 2026-05-17：per-field LINE 設定（業主要求每館獨立 LINE channel）
  // 不存 LIFF id（前端 build-time env、後續再支援動態載入）
  // Secret 用 text 存（建議 admin 加密、目前 plain text、未來可加 KMS）
  lineChannelId: varchar("line_channel_id", { length: 50 }),
  lineChannelSecret: text("line_channel_secret"),
  lineChannelAccessToken: text("line_channel_access_token"),
  lineLiffId: varchar("line_liff_id", { length: 50 }),
  // LINE 模組是否啟用（即使填了 channel 也可暫關）
  lineEnabled: varchar("line_enabled", { length: 10 }).default("false"),
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
  /**
   * 場域封面圖片焦點位置（CSS object-position 格式）
   * 範例："50% 50%"（置中，預設）/ "30% 20%"（偏左上）
   * 由 admin 在前端拖拉調整 → 玩家端按此焦點顯示，避免重要元素被裁切
   */
  coverImagePosition?: string;
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
  /** 🆕 公告開始日期（ISO YYYY-MM-DD；未設 = 立即開始）*/
  announcementStartAt?: string;
  /** 🆕 公告結束日期（ISO YYYY-MM-DD；未設 = 不設期限）*/
  announcementEndAt?: string;
  /** 🆕 公告嚴重程度 — info = 琥珀色可關 / urgent = 紅色不可關（預設 info） */
  announcementSeverity?: "info" | "urgent";

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

  // 🆕 Phase 4.4 多人遊戲斷線寬限期（單位：秒）
  //   未設值 → server 用環境變數 / 預設（30s 寬限 + 120s auto leave）
  //   admin 後台 UI 預備中（目前需 ops 改 server 環境變數 DISCONNECT_GRACE_MS / AUTO_LEAVE_AFTER_GRACE_MS）
  disconnectGracePeriodSec?: number;     // 預設 30，玩家斷線後寬限期（秒）
  autoLeaveAfterGraceSec?: number;       // 預設 120，寬限期過後到自動 leave 的秒數
  /** 暫停策略：always_pause（一律暫停）/ never_pause（不暫停）/ leader_decide（隊長決定，預設）*/
  disconnectPauseStrategy?: "always_pause" | "never_pause" | "leader_decide";

  // 🆕 新場域 onboarding — 場域級別標記，避免 localStorage 只管當前設備
  // 當場域首次授權的 admin 完成 FieldOnboardingWizard 後設為 true，之後不再跳
  hasCompletedOnboarding?: boolean;

  // 🆕 v2: 場域專屬紀念照模板（覆寫系統預設 ACHIEVEMENT_COMPOSITION_CONFIG）
  // 未設定時走系統預設（GET /api/photo-composite/achievement-config 的內容）
  // 設定後：photo_spot / photo_compare / achievement_card 等合成時優先用這個
  photoTemplates?: {
    /** 成就卡模板（GameCompletionScreen 用）*/
    achievement?: {
      enabled?: boolean;          // 預設 true
      canvas?: {
        width?: number;
        height?: number;
        crop?: "fill" | "fit" | "limit" | "scale" | "pad";
      };
      /** 文字圖層陣列（圖片圖層先不支援自訂以降低複雜度） */
      textLayers?: Array<{
        text: string;              // 支援 {fieldName} / {gameTitle} / {score} / {date} / {playerName} 插值
        size?: number;             // 預設 48
        color?: string;            // 預設 "white"
        background?: string;       // 預設透明
        gravity?: string;          // 預設 "south"
        offsetY?: number;
        bold?: boolean;
      }>;
    };
    /** 拍照紀念照模板（photo_spot / photo_compare 用）*/
    memorial?: {
      enabled?: boolean;
      canvas?: {
        width?: number;
        height?: number;
        crop?: "fill" | "fit" | "limit" | "scale" | "pad";
      };
      textLayers?: Array<{
        text: string;
        size?: number;
        color?: string;
        background?: string;
        gravity?: string;
        offsetY?: number;
        bold?: boolean;
      }>;
    };
  };
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
