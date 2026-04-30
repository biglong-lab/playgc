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

// ⚠️ 模型清單依「實測通過」排序（2026-04-30 跑過完整測試）
// 測試結果：
//   - mistral-small-3.2-24b: 3/3 通過、0.9-2.3s、JSON 格式穩定 ⭐ 最佳
//   - llama-4-scout: 3/3 通過、1-3s、JSON 穩定
//   - gemma-3-12b-it:free: 3/3 通過但 11-37s（太慢）
//   - gemma-3-27b-it:free: 「JSON mode is not enabled」全失敗
//   - gemini-2.0-flash-001: 「不再對新用戶開放」+ 504 全失敗
//   - gemini-2.0-flash-lite-001: 504 timeout 嚴重
export const AI_MODELS: AIModelOption[] = [
  // ⭐ 主力：實測最快最穩
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    label: "Mistral Small 3.2 24B ⭐ 推薦",
    description: "實測 3/3 通過，速度 0.9-2.3s，$0.075/M 輸入（最便宜的穩定 vision）",
    priceIn: 0.075,
    priceOut: 0.2,
    tier: "budget",
    vision: true,
  },
  {
    id: "meta-llama/llama-4-scout",
    label: "Llama 4 Scout",
    description: "實測 3/3 通過，速度 1-3s，$0.08/M 輸入",
    priceIn: 0.08,
    priceOut: 0.3,
    tier: "budget",
    vision: true,
  },
  // 🆓 免費保底（速度慢但能用）
  {
    id: "google/gemma-3-12b-it:free",
    label: "Gemma 3 12B（免費）",
    description: "免費保底、實測 3/3 通過但速度慢（11-37s），32k context",
    priceIn: 0,
    priceOut: 0,
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
 *
 * 2026-04-30 完整測試結果（後浦金城場域 OpenRouter key × 8 個模型）：
 *   ✅ mistralai/mistral-small-3.2-24b-instruct  — 3/3 通過、0.9-2.3s ⭐ 最佳
 *   ✅ meta-llama/llama-4-scout                  — 3/3 通過、1-3s
 *   ✅ google/gemma-3-12b-it:free                — 3/3 通過但 11-37s（太慢）
 *   ❌ google/gemma-3-27b-it:free                — 「JSON mode 不支援」
 *   ❌ google/gemini-2.0-flash-001               — 「不再對新用戶開放」
 *   ❌ google/gemini-2.0-flash-lite-001          — 504 timeout
 *   ❌ meta-llama/llama-3.2-11b-vision-instruct:free — 404
 *   ⚠️ nvidia/nemotron-nano-12b-v2-vl:free      — JSON 格式不穩
 *
 * 結論：選 Mistral Small 為主預設（最快、最便宜的穩定 vision）
 */
export const DEFAULT_VISION_MODEL = "mistralai/mistral-small-3.2-24b-instruct";
export const DEFAULT_TEXT_MODEL = "mistralai/mistral-small-3.2-24b-instruct";

/**
 * 🔄 Fallback chain：當主模型 429 / 404 / 5xx 時依序嘗試
 *
 * 速度優先設計（玩家等不了 11-37 秒）：
 *   L1: Mistral Small 24B（$0.075/M、0.9-2.3s）
 *   L2: Llama 4 Scout（$0.08/M、1-3s）
 *   L3: Gemma 3 12B 免費（11-37s 慢但保底）
 */
export const OPENROUTER_FALLBACK_CHAIN = [
  "mistralai/mistral-small-3.2-24b-instruct", // L1: 最快最便宜（實測 0.9-2.3s）
  "meta-llama/llama-4-scout",                  // L2: 速度快（實測 1-3s）
  "google/gemma-3-12b-it:free",                // L3: 免費保底（實測 11-37s）
] as const;

/**
 * 已下架 / 不能用模型 → 自動跳過，改用 DEFAULT_VISION_MODEL
 * 場域 DB 可能還存著這些舊 model id
 */
export const DEPRECATED_OPENROUTER_MODELS = new Set<string>([
  "google/gemini-flash-1.5",                       // 2026-04 下架（404）
  "google/gemini-flash-1.5-8b",                    // 2026-04 下架
  "google/gemini-2.0-flash-001",                   // 「不再對新用戶開放」+ 504
  "google/gemini-2.0-flash-lite-001",              // 504 timeout 嚴重
  "google/gemma-3-27b-it:free",                    // JSON mode 不支援（OpenRouter Provider error 400）
  "meta-llama/llama-3.2-11b-vision-instruct:free", // 404 No endpoints
  "nvidia/nemotron-nano-12b-v2-vl:free",           // JSON 格式不穩
]);
