// 🔒 Webhook 簽章驗證共用工具
//
// 設計目的：先前 4 個 webhook signature verifier 各自實作（line-bot / recur-tw / recur-client / aihomi-adapter）、
// 風格不一（hex vs base64 / 有的長度檢查有的沒有 / 有的 try/catch 有的會 throw）、
// 經 Codex 9 輪審查後統一 timing-safe pattern、本檔提取 shared util 防未來再次風格分裂。
//
// 設計依據：docs/changes/2026-05-03-security-and-ux-fixes.md「shared util」反思
//
// 提供 2 個函式：
//   1. verifyHmacSignature — HMAC-SHA256 簽章驗證（hex / base64 編碼可選）
//   2. verifySharedSecret  — 直接 secret 比對（無雜湊、用於簡單 header secret）
//
// 兩者都用 crypto.timingSafeEqual 防 timing attack、空輸入一律 false（不 throw）

import crypto from "crypto";

export type SignatureEncoding = "hex" | "base64";

/**
 * 驗證 HMAC 簽章（預設 SHA-256）
 *
 * 用於：webhook provider 用 secret 對 raw body 做 HMAC、把結果放 header 裡傳
 *
 * @param rawPayload 原始 request body string（未經 JSON.parse）
 * @param signature  header 帶的簽章（hex 或 base64 字串）
 * @param secret     雙方共享的 webhook secret
 * @param encoding   簽章編碼：'hex'（多數）或 'base64'（LINE 用）
 * @param algorithm  HMAC 演算法（預設 'sha256'）
 * @returns 是否驗章通過（簽章 / secret / payload 任一空 → false；長度不符 → false）
 */
export function verifyHmacSignature(
  rawPayload: string,
  signature: string | undefined,
  secret: string,
  encoding: SignatureEncoding = "hex",
  algorithm: string = "sha256",
): boolean {
  if (!signature || !secret || !rawPayload) return false;
  try {
    const expected = crypto
      .createHmac(algorithm, secret)
      .update(rawPayload)
      .digest(encoding);
    const sigBuf = Buffer.from(signature, encoding);
    const expBuf = Buffer.from(expected, encoding);
    // timingSafeEqual 長度不符會 throw、必須先 check
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * 驗證 Stripe webhook 簽章
 *
 * Stripe 格式：header `stripe-signature: t=<timestamp>,v1=<sig>[,v1=<sig>...]`
 * 簽章對象：`${timestamp}.${rawBody}` 的 HMAC-SHA256（hex）
 * 含時間戳容忍檢查（預設 5 分鐘）防重放攻擊
 *
 * @param rawPayload 原始 request body string（未經 JSON.parse）
 * @param sigHeader  stripe-signature header 原始值
 * @param secret     webhook signing secret（whsec_*）
 * @param toleranceSec 時間戳容忍秒數（預設 300）
 */
export function verifyStripeWebhookSignature(
  rawPayload: string,
  sigHeader: string | undefined,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!sigHeader || !secret || !rawPayload) return false;
  try {
    const parts = sigHeader.split(",").map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
    const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts)) return false;
    if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

    const signedPayload = `${timestamp}.${rawPayload}`;
    return signatures.some((sig) =>
      verifyHmacSignature(signedPayload, sig, secret, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * 驗證 shared secret（直接比對、不經雜湊）
 *
 * 用於：簡單的 header X-API-Secret = <stored_secret> 場景
 * 注意：較弱於 HMAC 簽章（攻擊者拿到 secret 即可偽造）、用 HMAC pattern 更佳
 *
 * @param fromHeader header 帶的 secret 值
 * @param storedSecret DB / env 儲存的對應 secret
 * @returns 是否一致（任一空 → false；長度不符 → false）
 */
export function verifySharedSecret(
  fromHeader: string | undefined,
  storedSecret: string | undefined | null,
): boolean {
  if (!fromHeader || !storedSecret) return false;
  try {
    const headerBuf = Buffer.from(fromHeader);
    const storedBuf = Buffer.from(storedSecret);
    if (headerBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(headerBuf, storedBuf);
  } catch {
    return false;
  }
}
