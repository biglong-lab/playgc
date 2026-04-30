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
  // 視覺 + 文字 都支援
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash ⭐ 推薦",
    description: "便宜、中文好、支援 vision（每 1M token $0.1 輸入）",
    priceIn: 0.1,
    priceOut: 0.4,
    tier: "budget",
    vision: true,
  },
  {
    id: "google/gemini-flash-1.5-8b",
    label: "Gemini 1.5 Flash 8B",
    description: "更便宜的 1.5 系列（每 1M token $0.0375 輸入），仍可用",
    priceIn: 0.0375,
    priceOut: 0.15,
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

/** 預設模型（用於場域未設定時 fallback）
 * ⚠️ 2026-04-30 修正：原本 "google/gemini-flash-1.5" 已被 OpenRouter 下架（404 No endpoints found）
 * 改用 "google/gemini-2.0-flash-001"（穩定版本，免費額度大）
 * 監控：OpenRouter 模型清單 https://openrouter.ai/models
 */
export const DEFAULT_VISION_MODEL = "google/gemini-2.0-flash-001";
export const DEFAULT_TEXT_MODEL = "google/gemini-2.0-flash-001";
