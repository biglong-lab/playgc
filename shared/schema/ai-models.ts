// OpenRouter 推薦模型清單（依「便宜但不笨」排序）
// 實測 $/1M tokens（OpenRouter 2026 Q1 價格）

export interface AIModelOption {
  id: string;
  label: string;
  description: string;
  /** 輸入 $/M tokens */
  priceIn: number;
  priceOut: number;
  /** 推薦等級 */
  tier: "budget" | "balanced" | "premium";
  /** 是否支援 vision */
  vision: boolean;
}

export const AI_MODELS: AIModelOption[] = [
  // 🆓 免費模型（推薦，OpenRouter 提供額度）
  {
    id: "google/gemma-3-27b-it:free",
    label: "Gemma 3 27B（免費）⭐ 推薦",
    description: "完全免費、Google 27B 開源模型、支援 vision、131k context（中文 OK）",
    priceIn: 0,
    priceOut: 0,
    tier: "budget",
    vision: true,
  },
  {
    id: "google/gemma-3-12b-it:free",
    label: "Gemma 3 12B（免費）",
    description: "免費、模型較小較快、32k context（簡單任務優先）",
    priceIn: 0,
    priceOut: 0,
    tier: "budget",
    vision: true,
  },
  // 💰 付費備援（免費限流時用）
  {
    id: "google/gemini-2.0-flash-lite-001",
    label: "Gemini 2.0 Flash Lite",
    description: "便宜備援、Google 系、1M context、$0.075/M 輸入",
    priceIn: 0.075,
    priceOut: 0.3,
    tier: "budget",
    vision: true,
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    description: "穩定 + 中文好、1M context、$0.1/M 輸入",
    priceIn: 0.1,
    priceOut: 0.4,
    tier: "budget",
    vision: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    description: "OpenAI 均衡選擇、vision 強、中文尚可",
    priceIn: 0.15,
    priceOut: 0.6,
    tier: "balanced",
    vision: true,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    description: "中文最好、vision 支援、略貴",
    priceIn: 1.0,
    priceOut: 5.0,
    tier: "balanced",
    vision: true,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet（進階）",
    description: "最準、最強、但最貴，適合高難度判斷",
    priceIn: 3.0,
    priceOut: 15.0,
    tier: "premium",
    vision: true,
  },
];

/** 🎯 預設模型（用於場域未指定時）
 * 2026-04-30 — 用免費 Gemma 3 27B 當主預設（vision=True、131k context、Google 出品）
 * 限流/失效時自動降級（見 OPENROUTER_FALLBACK_CHAIN）
 */
export const DEFAULT_VISION_MODEL = "google/gemma-3-27b-it:free";
export const DEFAULT_TEXT_MODEL = "google/gemma-3-27b-it:free";

/**
 * 🔄 Fallback chain：當主模型 429（限流）/ 404（下架）/ 5xx（暫時性錯誤）時依序嘗試
 *
 * 設計原則：
 *   1. 主模型用免費 → 大量請求時可能 429
 *   2. 第一備援用便宜的 Gemini 2.0 Flash Lite（$0.075/M）
 *   3. 第二備援用穩定的 Gemini 2.0 Flash（$0.1/M）
 *   4. 全部失敗才 503
 */
export const OPENROUTER_FALLBACK_CHAIN = [
  "google/gemma-3-27b-it:free",         // L1: 免費主力
  "google/gemini-2.0-flash-lite-001",   // L2: $0.075/M 便宜備援
  "google/gemini-2.0-flash-001",        // L3: $0.1/M 穩定備援
] as const;

/**
 * 已下架模型 → 自動換成 DEFAULT_VISION_MODEL
 * 場域舊 DB 可能還存著這些 model id（OpenRouter 已 404 No endpoints found）
 */
export const DEPRECATED_OPENROUTER_MODELS = new Set<string>([
  "google/gemini-flash-1.5",     // 2026-04 下架
  "google/gemini-flash-1.5-8b",  // 2026-04 下架
]);
