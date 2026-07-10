// 🔒 Shared webhook-signature util 單元測試
// 測試 4 個 callers（line-bot / recur-tw / recur-client / aihomi-adapter）的共用基礎函式

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyHmacSignature,
  verifySharedSecret,
  verifyStripeWebhookSignature,
} from "../lib/webhook-signature";

const SECRET = "test-secret-12345";

function signHex(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function signBase64(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

describe("verifyHmacSignature (hex)", () => {
  const payload = JSON.stringify({ type: "test" });

  it("正確簽章 → true", () => {
    expect(verifyHmacSignature(payload, signHex(payload, SECRET), SECRET, "hex")).toBe(true);
  });

  it("payload 被竄改 → false", () => {
    const sig = signHex(payload, SECRET);
    expect(verifyHmacSignature(payload + "x", sig, SECRET, "hex")).toBe(false);
  });

  it("錯誤 secret → false", () => {
    expect(verifyHmacSignature(payload, signHex(payload, SECRET), "wrong", "hex")).toBe(false);
  });

  it("空簽章 → false", () => {
    expect(verifyHmacSignature(payload, "", SECRET, "hex")).toBe(false);
    expect(verifyHmacSignature(payload, undefined, SECRET, "hex")).toBe(false);
  });

  it("空 secret → false", () => {
    expect(verifyHmacSignature(payload, signHex(payload, SECRET), "", "hex")).toBe(false);
  });

  it("空 payload → false", () => {
    expect(verifyHmacSignature("", signHex("any", SECRET), SECRET, "hex")).toBe(false);
  });

  it("簽章長度不符 → false 不 throw", () => {
    expect(verifyHmacSignature(payload, "abc", SECRET, "hex")).toBe(false);
  });

  it("非法 hex → false 不 throw", () => {
    expect(verifyHmacSignature(payload, "zzz!notvalidhex", SECRET, "hex")).toBe(false);
  });
});

describe("verifyHmacSignature (base64) — LINE webhook 用", () => {
  const payload = JSON.stringify({ events: [] });

  it("正確 base64 簽章 → true", () => {
    expect(verifyHmacSignature(payload, signBase64(payload, SECRET), SECRET, "base64")).toBe(true);
  });

  it("base64 payload 被竄改 → false", () => {
    const sig = signBase64(payload, SECRET);
    expect(verifyHmacSignature(payload + "x", sig, SECRET, "base64")).toBe(false);
  });

  it("base64 錯誤 secret → false", () => {
    expect(verifyHmacSignature(payload, signBase64(payload, SECRET), "wrong", "base64")).toBe(false);
  });
});

describe("verifySharedSecret", () => {
  it("正確 secret → true", () => {
    expect(verifySharedSecret("my-secret", "my-secret")).toBe(true);
  });

  it("錯誤 secret → false", () => {
    expect(verifySharedSecret("my-secret", "other-secret")).toBe(false);
  });

  it("空 fromHeader → false", () => {
    expect(verifySharedSecret("", "stored")).toBe(false);
    expect(verifySharedSecret(undefined, "stored")).toBe(false);
  });

  it("空 storedSecret → false", () => {
    expect(verifySharedSecret("header-val", "")).toBe(false);
    expect(verifySharedSecret("header-val", null)).toBe(false);
    expect(verifySharedSecret("header-val", undefined)).toBe(false);
  });

  it("長度不符 → false 不 throw", () => {
    expect(verifySharedSecret("ab", "abc")).toBe(false);
  });

  it("不同字元同長度 → false", () => {
    expect(verifySharedSecret("abc123", "xyz789")).toBe(false);
  });
});

describe("verifyStripeWebhookSignature", () => {
  const PAYLOAD = '{"type":"checkout.session.completed"}';

  function stripeHeader(payload: string, secret: string, ts?: number): string {
    const t = ts ?? Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    return `t=${t},v1=${sig}`;
  }

  it("正確簽章 → true", () => {
    expect(verifyStripeWebhookSignature(PAYLOAD, stripeHeader(PAYLOAD, SECRET), SECRET)).toBe(true);
  });

  it("錯誤 secret 簽的 → false", () => {
    expect(verifyStripeWebhookSignature(PAYLOAD, stripeHeader(PAYLOAD, "wrong-secret"), SECRET)).toBe(false);
  });

  it("payload 被竄改 → false", () => {
    const header = stripeHeader(PAYLOAD, SECRET);
    expect(verifyStripeWebhookSignature('{"type":"charge.refunded"}', header, SECRET)).toBe(false);
  });

  it("時間戳過期（超過容忍）→ false（防重放）", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyStripeWebhookSignature(PAYLOAD, stripeHeader(PAYLOAD, SECRET, oldTs), SECRET)).toBe(false);
  });

  it("多個 v1 簽章、其中一個正確 → true（Stripe 金鑰輪替期行為）", () => {
    const t = Math.floor(Date.now() / 1000);
    const good = crypto.createHmac("sha256", SECRET).update(`${t}.${PAYLOAD}`).digest("hex");
    const header = `t=${t},v1=${"0".repeat(64)},v1=${good}`;
    expect(verifyStripeWebhookSignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it("header 缺失 / 格式錯誤 → false 不 throw", () => {
    expect(verifyStripeWebhookSignature(PAYLOAD, undefined, SECRET)).toBe(false);
    expect(verifyStripeWebhookSignature(PAYLOAD, "garbage", SECRET)).toBe(false);
    expect(verifyStripeWebhookSignature(PAYLOAD, "t=abc,v1=zzz", SECRET)).toBe(false);
    expect(verifyStripeWebhookSignature("", stripeHeader(PAYLOAD, SECRET), SECRET)).toBe(false);
  });
});
