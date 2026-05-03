// 🔒 Recur.tw webhook HMAC SHA-256 簽章驗證單元測試
// 安全性 P0：之前 stub 直接 return true → 任何 POST 都當 valid → email spam 跳板
// 修法：實作真正 HMAC SHA-256 hex + timing-safe equal

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyRecurWebhookSignature } from "../lib/recur-tw";

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

const SECRET = "test-webhook-secret-12345";

describe("verifyRecurWebhookSignature", () => {
  it("正確簽章 → true", () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const sig = sign(payload, SECRET);
    expect(verifyRecurWebhookSignature(payload, sig, SECRET)).toBe(true);
  });

  it("payload 被竄改 → false", () => {
    const original = JSON.stringify({ type: "checkout.session.completed" });
    const sig = sign(original, SECRET);
    const tampered = JSON.stringify({ type: "checkout.session.completed", evil: true });
    expect(verifyRecurWebhookSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("簽章被竄改 → false", () => {
    const payload = JSON.stringify({ type: "test" });
    const sig = sign(payload, SECRET);
    const tampered = sig.slice(0, -2) + "00";
    expect(verifyRecurWebhookSignature(payload, tampered, SECRET)).toBe(false);
  });

  it("錯誤的 secret → false", () => {
    const payload = JSON.stringify({ type: "test" });
    const sig = sign(payload, SECRET);
    expect(verifyRecurWebhookSignature(payload, sig, "wrong-secret")).toBe(false);
  });

  it("空簽章 → false", () => {
    const payload = JSON.stringify({ type: "test" });
    expect(verifyRecurWebhookSignature(payload, "", SECRET)).toBe(false);
  });

  it("空 secret → false", () => {
    const payload = JSON.stringify({ type: "test" });
    const sig = sign(payload, SECRET);
    expect(verifyRecurWebhookSignature(payload, sig, "")).toBe(false);
  });

  it("空 payload → false", () => {
    const sig = sign("dummy", SECRET);
    expect(verifyRecurWebhookSignature("", sig, SECRET)).toBe(false);
  });

  it("簽章長度不符（防 timingSafeEqual throw）→ false 不 throw", () => {
    const payload = JSON.stringify({ type: "test" });
    expect(verifyRecurWebhookSignature(payload, "abc", SECRET)).toBe(false);
  });

  it("非法 hex 簽章 → false 不 throw", () => {
    const payload = JSON.stringify({ type: "test" });
    expect(verifyRecurWebhookSignature(payload, "zzz!notvalidhex", SECRET)).toBe(false);
  });

  it("不同 payload 產生不同簽章（無碰撞）", () => {
    const sig1 = sign("payload1", SECRET);
    const sig2 = sign("payload2", SECRET);
    expect(sig1).not.toBe(sig2);
    expect(verifyRecurWebhookSignature("payload1", sig1, SECRET)).toBe(true);
    expect(verifyRecurWebhookSignature("payload2", sig1, SECRET)).toBe(false);
  });
});
