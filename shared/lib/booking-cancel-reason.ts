// 🚫 後台取消預約原因規則（2026-09-23，前後端共用）
//
// 取消會推 LINE 通知給玩家、原因玩家看得到 → 必填且要說清楚。
// 前端即時提示與後端驗證共用同一份規則，避免兩邊標準不一。
import { z } from "zod";

export const CANCEL_REASON_MIN_LENGTH = 5;
export const CANCEL_REASON_MAX_LENGTH = 200;

const REQUIRED_MESSAGE = `請填寫取消原因（至少 ${CANCEL_REASON_MIN_LENGTH} 個字）`;

/** 以「字」計（emoji / 罕用字不因 UTF-16 被算成兩個） */
function charCount(text: string): number {
  return Array.from(text).length;
}

/** 取消原因 zod schema：去頭尾空白後 5～200 字 */
export const cancelReasonSchema = z
  .string({ required_error: REQUIRED_MESSAGE, invalid_type_error: REQUIRED_MESSAGE })
  .trim()
  .superRefine((text, ctx) => {
    const count = charCount(text);
    if (count === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQUIRED_MESSAGE });
    } else if (count < CANCEL_REASON_MIN_LENGTH) {
      const lack = CANCEL_REASON_MIN_LENGTH - count;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `取消原因至少 ${CANCEL_REASON_MIN_LENGTH} 個字（還差 ${lack} 個字）`,
      });
    } else if (count > CANCEL_REASON_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `取消原因最多 ${CANCEL_REASON_MAX_LENGTH} 個字`,
      });
    }
  });

export type CancelReasonCheck = { ok: true; reason: string } | { ok: false; message: string };

/** 驗證取消原因；通過時回傳去頭尾空白後的原因 */
export function checkCancelReason(raw: unknown): CancelReasonCheck {
  const parsed = cancelReasonSchema.safeParse(raw ?? undefined);
  if (parsed.success) return { ok: true, reason: parsed.data };
  return { ok: false, message: parsed.error.errors[0]?.message ?? REQUIRED_MESSAGE };
}
