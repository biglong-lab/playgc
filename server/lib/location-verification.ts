// 多元定位驗證 — 後端驗證邏輯
//
// 用途：GPS 失效時的備援驗證機制
// 相關文件：docs/changes/2026-05-22-multi-tier-location-verification.md
//
// 五種驗證方式：
//   gps   — Haversine 距離 ≤ radius
//   qr    — 比對 qr_token（HMAC 簽章）
//   code  — 比對 verification_code（4-6 位）
//   pdr   — 出發點相對推算（誤差大，僅作導引）
//   ar    — 影像特徵比對（Phase 3）
//   admin — 管理員強制標記（需 admin 身份）

import crypto from "node:crypto";
import { distanceMeters } from "./geo";
import type { Location } from "@shared/schema";

export type VerifyMethod = "gps" | "qr" | "code" | "pdr" | "ar" | "admin";
export type VerifyMode = "gps" | "qr" | "code" | "hybrid" | "any";

export interface VerifyPayload {
  // GPS
  lat?: number;
  lng?: number;
  accuracy?: number;
  // QR
  qrToken?: string;
  // Code
  code?: string;
  // PDR
  startLat?: number;
  startLng?: number;
  stepsSinceReset?: number;
  // AR
  matchScore?: number;
  referenceImageId?: string;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────
// QR Token 簽章（避免偽造）
// ─────────────────────────────────────────────────────

const QR_SECRET = process.env.QR_TOKEN_SECRET || process.env.SESSION_SECRET || "qr-fallback-dev-secret";

export function generateQrToken(locationId: number): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${locationId}:${nonce}`;
  const sig = crypto
    .createHmac("sha256", QR_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return `${payload}:${sig}`;
}

export function verifyQrToken(token: string, expectedLocationId: number): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [locIdStr, nonce, sig] = parts;
  if (parseInt(locIdStr, 10) !== expectedLocationId) return false;
  const expected = crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${locIdStr}:${nonce}`)
    .digest("hex")
    .slice(0, 16);
  // 用 timingSafeEqual 防 timing attack
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────
// 短碼生成（4-6 位）
// ─────────────────────────────────────────────────────

export function generateShortCode(length: 4 | 5 | 6 = 4): string {
  // 排除易混淆字元（0/O, 1/I/L）
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─────────────────────────────────────────────────────
// 模式相容性檢查
// ─────────────────────────────────────────────────────

export function isMethodAllowedByMode(method: VerifyMethod, mode: VerifyMode | string | null): boolean {
  // admin 救援永遠可用（由路由層另外鑑權）
  if (method === "admin") return true;

  const m = (mode || "gps") as VerifyMode;
  switch (m) {
    case "gps":
      return method === "gps" || method === "pdr";
    case "qr":
      return method === "qr";
    case "code":
      return method === "code";
    case "hybrid":
      return method === "gps" || method === "qr" || method === "code";
    case "any":
      return true;
    default:
      return method === "gps";
  }
}

// ─────────────────────────────────────────────────────
// 主驗證函式
// ─────────────────────────────────────────────────────

export function verifyVisit(
  method: VerifyMethod,
  payload: VerifyPayload,
  location: Pick<Location, "id" | "latitude" | "longitude" | "radius" | "verificationCode" | "qrToken" | "verificationMode" | "allowAdminRescue">
): VerifyResult {
  // 1. 檢查 method 是否被 location 允許
  if (!isMethodAllowedByMode(method, location.verificationMode || "gps")) {
    return {
      ok: false,
      reason: `此任務點不允許 ${method} 驗證方式（當前模式：${location.verificationMode || "gps"}）`,
    };
  }

  // 2. 分流驗證
  switch (method) {
    case "gps":
      return verifyGps(payload, location);
    case "qr":
      return verifyQr(payload, location);
    case "code":
      return verifyCode(payload, location);
    case "pdr":
      // PDR 只能搭配 hybrid/any 模式，且要有出發點
      return verifyPdr(payload, location);
    case "ar":
      return verifyAr(payload);
    case "admin":
      // admin 由路由層判定權限後直接通過
      return {
        ok: location.allowAdminRescue !== false,
        reason: location.allowAdminRescue === false ? "此任務點禁用管理員救援" : undefined,
        metadata: { method: "admin", reason: "manual override" },
      };
  }
}

function verifyGps(
  payload: VerifyPayload,
  location: Pick<Location, "latitude" | "longitude" | "radius">
): VerifyResult {
  if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
    return { ok: false, reason: "缺少 GPS 座標" };
  }
  const locLat = parseFloat(location.latitude || "0");
  const locLng = parseFloat(location.longitude || "0");
  if (!locLat || !locLng) {
    return { ok: false, reason: "此任務點未設定 GPS 座標" };
  }
  const distance = distanceMeters(payload.lat, payload.lng, locLat, locLng);
  const radius = location.radius || 50;
  // 動態補償：精度差時放寬半徑（最多 +30m）
  const tolerance = Math.min(payload.accuracy || 0, 30);
  const effectiveRadius = radius + tolerance;

  if (distance > effectiveRadius) {
    return {
      ok: false,
      reason: `距離過遠（${Math.round(distance)}m，需 ≤ ${Math.round(effectiveRadius)}m）`,
      metadata: { distance, accuracy: payload.accuracy, radius },
    };
  }
  return {
    ok: true,
    metadata: { distance, accuracy: payload.accuracy, radius },
  };
}

function verifyQr(
  payload: VerifyPayload,
  location: Pick<Location, "id" | "qrToken">
): VerifyResult {
  if (!payload.qrToken) {
    return { ok: false, reason: "缺少 QR token" };
  }
  if (!location.qrToken) {
    return { ok: false, reason: "此任務點未啟用 QR 驗證" };
  }
  // 兩種驗證方式：完全比對（簡單）或簽章驗證（防偽造）
  if (payload.qrToken === location.qrToken) {
    return {
      ok: true,
      metadata: { method: "qr", tokenHash: hashToken(payload.qrToken) },
    };
  }
  // 簽章驗證
  if (verifyQrToken(payload.qrToken, location.id)) {
    return {
      ok: true,
      metadata: { method: "qr", tokenHash: hashToken(payload.qrToken) },
    };
  }
  return { ok: false, reason: "QR token 無效" };
}

function verifyCode(
  payload: VerifyPayload,
  location: Pick<Location, "verificationCode">
): VerifyResult {
  if (!payload.code) {
    return { ok: false, reason: "缺少代碼" };
  }
  if (!location.verificationCode) {
    return { ok: false, reason: "此任務點未設定代碼" };
  }
  // 不分大小寫比對
  if (payload.code.trim().toUpperCase() === location.verificationCode.trim().toUpperCase()) {
    return {
      ok: true,
      metadata: { method: "code", codeInput: payload.code.toUpperCase() },
    };
  }
  return { ok: false, reason: "代碼錯誤" };
}

function verifyPdr(
  payload: VerifyPayload,
  location: Pick<Location, "latitude" | "longitude" | "radius">
): VerifyResult {
  // PDR 用「出發點 + 步數」推算實際座標、再做 GPS 比對
  // 限制：步數 < 200 步（避免漂移過大）
  if (
    typeof payload.lat !== "number" ||
    typeof payload.lng !== "number" ||
    typeof payload.startLat !== "number" ||
    typeof payload.startLng !== "number"
  ) {
    return { ok: false, reason: "缺少 PDR 起點或當前推算座標" };
  }
  if ((payload.stepsSinceReset || 0) > 200) {
    return { ok: false, reason: "PDR 累積誤差過大，請靠近 QR 點重新校正" };
  }
  return verifyGps(payload, location);
}

function verifyAr(payload: VerifyPayload): VerifyResult {
  // Phase 3 — 影像比對分數 ≥ 0.7 通過
  const score = payload.matchScore || 0;
  if (score < 0.7) {
    return {
      ok: false,
      reason: `影像比對分數過低（${score.toFixed(2)} < 0.70）`,
    };
  }
  return {
    ok: true,
    metadata: { matchScore: score, referenceImageId: payload.referenceImageId },
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}
