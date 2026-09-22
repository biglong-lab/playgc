// 💵 POS 收款金額計算（純函式，2026-09-23 P0）
//
// 🐛 原本找零用「折扣前金額」算：收 1000 折 200（應收 800），客付 1000 → 畫面顯示找零 0（應找 200），
//   確認鈕 / 大金額確認也顯示折扣前金額 → 收銀員少找錢。記帳金額由後端重算，本來就正確。
// 規則：應收 = 金額 − 折扣（最少 0）；找零、「剛好」、大金額門檻、按鈕金額一律用應收。

/** NT$2000 以上要二次確認 */
export const LARGE_AMOUNT_CENTS = 200_000;

export interface CheckoutTotals {
  /** 應收（折扣後） */
  dueCents: number;
  /** 找零（負數 = 還差）；沒填客付時為 0 */
  changeCents: number;
  isLargeAmount: boolean;
}

export function computeCheckoutTotals(input: {
  amountCents: number;
  discountCents: number;
  tenderedCents: number;
}): CheckoutTotals {
  const amount = Math.max(0, input.amountCents);
  const discount = Math.min(Math.max(0, input.discountCents), amount);
  const dueCents = amount - discount;
  const changeCents = input.tenderedCents > 0 ? input.tenderedCents - dueCents : 0;
  return { dueCents, changeCents, isLargeAmount: dueCents >= LARGE_AMOUNT_CENTS };
}
