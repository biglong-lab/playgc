// 🎨 變體池 (Variant Pool) — 取代即時 AI 呼叫的訊息池
//
// 設計理念：
//   - admin 建立任務時，一次性 AI 生成 8-12 個訊息變體存進 variant_pool
//   - 玩家觸發任務時，從 pool 隨機抽一個（不再每次呼叫 AI）
//   - 效益：玩家 feedback 永不重複（多元感）+ AI 即時呼叫降 90%
//
// 結構：
//   pages.variant_pool = {
//     success: ["訊息 1", "訊息 2", ...],   // 成功時隨機抽
//     fail: ["...",],                      // 失敗鼓勵
//     nearMiss: ["...",],                  // 接近通過
//     hint: ["...",],                      // 提示用（可選）
//     generatedAt: ISO 8601,
//     model: "deepseek/deepseek-v3.2",
//   }
import { z } from "zod";

/** 單一變體類別的訊息陣列 schema */
export const variantMessagesSchema = z.array(z.string().min(1).max(120));

/** 完整變體池 schema */
export const variantPoolSchema = z.object({
  /** 成功訊息變體（拍照通過、答對等） */
  success: variantMessagesSchema.optional(),
  /** 失敗訊息變體（鼓勵性、不打擊） */
  fail: variantMessagesSchema.optional(),
  /** 接近通過的訊息（適用於 score-text 部分對） */
  nearMiss: variantMessagesSchema.optional(),
  /** 提示訊息（玩家卡住時顯示） */
  hint: variantMessagesSchema.optional(),
  /** 生成時間 */
  generatedAt: z.string().datetime().optional(),
  /** 生成模型 ID */
  model: z.string().optional(),
});

export type VariantMessages = z.infer<typeof variantMessagesSchema>;
export type VariantPool = z.infer<typeof variantPoolSchema>;

/** 變體池支援的訊息類別 */
export type VariantKey = "success" | "fail" | "nearMiss" | "hint";

/** 生成變體的請求 schema（給 admin API 用） */
export const generateVariantsRequestSchema = z.object({
  /** 任務情境描述（給 AI 參考） */
  taskContext: z.string().min(10).max(500),
  /** 每個類別生成幾個變體（預設 8） */
  count: z.number().int().min(3).max(20).default(8),
  /** 場域風格（戰術 / 歷史 / 兒童 / 文青 等） */
  fieldStyle: z.string().max(100).optional(),
  /** 要生成哪些類別（預設全部） */
  categories: z
    .array(z.enum(["success", "fail", "nearMiss", "hint"]))
    .min(1)
    .default(["success", "fail"]),
});

export type GenerateVariantsRequest = z.infer<typeof generateVariantsRequestSchema>;
