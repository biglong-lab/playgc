// 🛡️ 分數伺服器端驗證 — Shooting 作弊防線第二層
//
// 配合 client/src/lib/shootingValidation.ts（第一層）形成完整防護：
//   Client-side：PTT 節流 + 單次分數上限 + 次數上限 + totalScore vs hits.sum 一致性
//   Server-side：  ← 本模組
//     1. 硬上限檢查（單場最多分數）
//     2. 若有 shooting_records，比對 client 回報分數 vs 真實硬體記錄總和
//     3. 異常記錄到 client_events（運維可查），返回修正後的分數
//
// 設計原則：
//   - 容忍誤判：正常玩家不會被誤封（硬上限 10000 分 + 5× shooting 寬容）
//   - 永遠記錄：可疑案例寫 client_events，事後可查
//   - 軟修正：若 client 分數明顯 > 真實命中，用真實命中值取代（不直接拒絕完成）

import { storage } from "../storage";
import { db } from "../db";
import { clientEvents } from "@shared/schema";

/** 單場次最高分硬性上限 — 超過代表客戶端被改 */
export const MAX_SESSION_SCORE = 10000;

/** shooting 分數容忍倍率：client 可能含其他加分來源（GPS/拍照等）*/
export const SHOOTING_SCORE_TOLERANCE = 5;

export interface ScoreValidationResult {
  /** 驗證通過的安全分數（可能被修正） */
  safeScore: number;
  /** 是否被修正過 */
  adjusted: boolean;
  /** 被修正/拒絕的原因 */
  reason?: "over_hard_cap" | "exceeds_shooting_sum" | "negative_score";
  /** 原始 client 送來的分數 */
  clientScore: number;
  /** 真實 shooting_records 總和（若 session 有記錄） */
  actualShootingSum?: number;
}

/**
 * 驗證並修正 client 送來的 session 分數
 *
 * @param sessionId - Session ID
 * @param userId - 當前使用者（用於 client_events log）
 * @param clientScore - Client 送過來的分數
 * @param context - 用於 log 的上下文
 */
export async function validateSessionScore(opts: {
  sessionId: string;
  userId: string | null;
  clientScore: number;
  source: "chapter-complete" | "session-complete";
}): Promise<ScoreValidationResult> {
  const { sessionId, userId, clientScore, source } = opts;

  // 1. 基本衛生
  if (typeof clientScore !== "number" || !Number.isFinite(clientScore)) {
    await logSuspicious({
      sessionId,
      userId,
      source,
      code: "invalid_score_type",
      message: `分數型別錯誤 (${typeof clientScore})`,
      clientScore,
    });
    return {
      safeScore: 0,
      adjusted: true,
      reason: "negative_score",
      clientScore,
    };
  }

  if (clientScore < 0) {
    await logSuspicious({
      sessionId,
      userId,
      source,
      code: "negative_score",
      message: `負分數 ${clientScore}`,
      clientScore,
    });
    return {
      safeScore: 0,
      adjusted: true,
      reason: "negative_score",
      clientScore,
    };
  }

  // 2. 硬上限
  if (clientScore > MAX_SESSION_SCORE) {
    await logSuspicious({
      sessionId,
      userId,
      source,
      code: "over_hard_cap",
      message: `分數超過單場上限 ${clientScore} > ${MAX_SESSION_SCORE}`,
      clientScore,
    });
    return {
      safeScore: MAX_SESSION_SCORE,
      adjusted: true,
      reason: "over_hard_cap",
      clientScore,
    };
  }

  // 3. 比對真實 shooting_records（若有）
  const shootingRecords = await storage.getShootingRecords(sessionId);
  if (shootingRecords.length > 0) {
    const actualSum = shootingRecords.reduce(
      (sum, r) => sum + (r.hitScore ?? 0),
      0,
    );
    // 寬容倍率 — 留給 GPS/拍照等其他加分來源
    const tolerantCap = actualSum * SHOOTING_SCORE_TOLERANCE + 1000;

    if (clientScore > tolerantCap) {
      await logSuspicious({
        sessionId,
        userId,
        source,
        code: "exceeds_shooting_sum",
        message: `分數異常：${clientScore} > ${tolerantCap}（shooting sum ${actualSum}）`,
        clientScore,
        extra: { actualShootingSum: actualSum, tolerantCap },
      });
      return {
        safeScore: tolerantCap,
        adjusted: true,
        reason: "exceeds_shooting_sum",
        clientScore,
        actualShootingSum: actualSum,
      };
    }

    return {
      safeScore: clientScore,
      adjusted: false,
      clientScore,
      actualShootingSum: actualSum,
    };
  }

  // 4. 沒有 shooting_records — 只做硬上限檢查（已通過）
  return {
    safeScore: clientScore,
    adjusted: false,
    clientScore,
  };
}

/** 記錄可疑事件到 client_events（給運維查） */
async function logSuspicious(opts: {
  sessionId: string;
  userId: string | null;
  source: string;
  code: string;
  message: string;
  clientScore: number;
  extra?: Record<string, unknown>;
}) {
  try {
    await db.insert(clientEvents).values({
      eventType: "error",
      category: "shooting",
      code: opts.code,
      message: opts.message,
      severity: "warning",
      userId: opts.userId,
      context: {
        source: opts.source,
        sessionId: opts.sessionId,
        clientScore: opts.clientScore,
        serverValidation: true,
        ...opts.extra,
      },
    });
  } catch (err) {
    // client_events 寫入失敗不影響主流程
    console.error("[scoreValidation] failed to log suspicious event:", err);
  }
}
