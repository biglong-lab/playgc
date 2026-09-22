import { describe, it, expect } from "vitest";
import { computeCheckoutTotals } from "../pos-checkout-math";

describe("computeCheckoutTotals（POS 收款金額）", () => {
  it("🐛 有折扣：找零用折扣後應收（收 1000 折 200、客付 1000 → 找 200）", () => {
    expect(computeCheckoutTotals({ amountCents: 100_000, discountCents: 20_000, tenderedCents: 100_000 })).toEqual({
      dueCents: 80_000,
      changeCents: 20_000,
      isLargeAmount: false,
    });
  });

  it("沒折扣：行為不變", () => {
    const t = computeCheckoutTotals({ amountCents: 50_000, discountCents: 0, tenderedCents: 100_000 });
    expect(t.dueCents).toBe(50_000);
    expect(t.changeCents).toBe(50_000);
  });

  it("客付不足 → 負數（還差多少）", () => {
    expect(computeCheckoutTotals({ amountCents: 50_000, discountCents: 10_000, tenderedCents: 30_000 }).changeCents).toBe(-10_000);
  });

  it("沒填客付 → 找零 0", () => {
    expect(computeCheckoutTotals({ amountCents: 50_000, discountCents: 0, tenderedCents: 0 }).changeCents).toBe(0);
  });

  it("折扣大於金額 → 應收 0（不會變負數）", () => {
    expect(computeCheckoutTotals({ amountCents: 30_000, discountCents: 50_000, tenderedCents: 0 }).dueCents).toBe(0);
  });

  it("大金額確認看應收：折扣後低於 NT$2000 不必確認", () => {
    expect(computeCheckoutTotals({ amountCents: 210_000, discountCents: 20_000, tenderedCents: 0 }).isLargeAmount).toBe(false);
    expect(computeCheckoutTotals({ amountCents: 200_000, discountCents: 0, tenderedCents: 0 }).isLargeAmount).toBe(true);
  });
});
