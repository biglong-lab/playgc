// 熱路徑 per-user rate limit
// 目標：500 人同時玩時，防單一玩家寫腳本/誤觸爆打某 API
// 原則：套用在 isAuthenticated 之後的 route，透過 req.user 取 userId
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/** IPv6 安全的 IP key（避免使用者切換 IPv6 後綴繞過限速）*/
function safeIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? "");
}

/** 從 req 取得使用者識別碼（優先 userId，退回正規化後的 IP）*/
function getUserKey(req: Request): string {
  const r = req as Request & {
    user?: { claims?: { sub?: string }; id?: string };
  };
  const userId = r.user?.claims?.sub || r.user?.id;
  return userId ? `u:${userId}` : `ip:${safeIp(req)}`;
}

/**
 * 高頻熱路徑（玩家進度更新、位置上報）
 * 每分鐘 120 次（≈2 次/秒）— 正常玩家通過一頁約 1 次，爆打代表有問題
 */
export const hotPathLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `hot:${getUserKey(req)}`,
  message: { message: "操作過於頻繁，請稍後再試" },
});

/**
 * 聊天訊息
 * 每分鐘 30 則（每 2 秒一則足夠）— 防刷屏
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `chat:${getUserKey(req)}`,
  message: { message: "發送訊息過於頻繁，請稍後再試" },
});

/**
 * 上傳類（照片、檔案）
 * 每 10 分鐘 30 次 — 防濫用上傳空間、頻寬
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `upload:${getUserKey(req)}`,
  message: { message: "上傳頻率過高，請稍後再試" },
});

/**
 * AI 端點（費用高）
 * 每分鐘 10 次、每小時 60 次
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${getUserKey(req)}`,
  message: { message: "AI 驗證請求過於頻繁，請稍後再試" },
});

/**
 * 🔐 2026-07-09 S3：隊伍動作（建隊/加隊/rejoin）
 * 每 5 分鐘 30 次 — 正常玩家一場活動不會超過個位數，防腳本灌隊伍
 */
export const teamActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `team:${getUserKey(req)}`,
  message: { message: "隊伍操作過於頻繁，請稍後再試" },
});

/**
 * 🔐 2026-07-09 S3：建立遊戲場次
 * 每 10 分鐘 30 次 — 正常重玩/測試綽綽有餘，防誤觸/腳本灌 session
 *（配合同日 CHITO #f095652b 的「建新自動放棄舊 playing」雙保險）
 */
export const sessionCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `sess:${getUserKey(req)}`,
  message: { message: "建立場次過於頻繁，請稍後再試" },
});

/**
 * 公開寫入端點（無 auth、寫 DB）
 * 每 IP 每小時 10 次 — 防 spam（如 /api/apply 場域申請、防 abuse 灌假申請）
 */
export const publicWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pubwrite:ip:${safeIp(req)}`,
  message: { message: "請求過於頻繁，請稍後再試" },
});
