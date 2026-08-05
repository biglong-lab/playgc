// 🔐 team-membership — 隊伍成員驗證（統一實作）
//
// 背景（2026-07-09 全站安全盤點 S1/S2）：
//   isTeamMember 原本散落 5 個路由檔各自複製一份，新端點容易漏掛 —
//   實際漏網：GET /api/teams/:teamId/votes、GET /api/teams/:teamId/score-history
//   只驗登入不驗隊員 → 任何登入者可讀他隊投票與分數（IDOR 讀取）。
//   此模組提供單一事實來源 + Express middleware，新 team 資源端點一律掛
//   requireTeamMember，不再各自手寫。

import type { Response, NextFunction } from "express";
import { db } from "../db";
import { teamMembers, teams } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import type { AuthenticatedRequest } from "../routes/types";

/** 是否為該隊現任成員（leftAt 為 null） */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const m = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        isNull(teamMembers.leftAt),
      ),
    )
    .limit(1);
  return m.length > 0;
}

/**
 * Express middleware：要求請求者是 req.params.teamId 的現任成員
 * 前置條件：路由已掛 isAuthenticated（req.user 已填）
 * 失敗回應：401 未登入 / 403 非隊員 / 400 缺 teamId
 */
export async function requireTeamMember(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const teamId = req.params.teamId;
    const userId = req.user?.claims?.sub;
    if (!userId) {
      res.status(401).json({ message: "請先登入" });
      return;
    }
    if (!teamId) {
      res.status(400).json({ message: "缺少 teamId" });
      return;
    }
    if (!(await isTeamMember(teamId, userId))) {
      res.status(403).json({ message: "您不是此隊伍的成員" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ message: "成員驗證失敗" });
  }
}

/** 可以重新歸隊的隊伍狀態 —— 已結束/解散的隊伍不讓人被自動加回 */
const REJOINABLE_TEAM_STATUSES = ["forming", "ready", "playing"] as const;

/**
 * 撤銷「系統自動離隊」——玩家切背景太久被寬限期踢掉後又回來時呼叫。
 *
 * 為什麼需要：auto_leave 會寫 DB 的 leftAt，但重連只把人加回記憶體房間、
 * 沒清 DB。結果 WS 說「他在」、DB 說「他離隊了」——玩家一重整就發現自己不在
 * 隊上，隊友從 DB 讀成員也看不到他（畫面不同步）。2026-08-05 實測生產資料：
 * 279 次 auto_leave 中有 71 次（25%）該玩家事後仍有 WS 活動，人其實還在玩。
 *
 * 兩個限制條件是刻意的、不可放寬：
 *   1. 只清 left_reason='auto_leave' —— manual/kicked 若也清，被踢的人
 *      一重連就自己回來了，等於踢不掉人
 *   2. 隊伍必須還在進行中 —— 不把玩家加回已結束/解散的隊伍
 *
 * @returns 是否真的撤銷了（false = 沒有可撤銷的紀錄，屬正常情況）
 */
export async function revokeAutoLeave(teamId: string, userId: string): Promise<boolean> {
  try {
    const result = await db
      .update(teamMembers)
      .set({ leftAt: null, leftReason: null })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.leftReason, "auto_leave"),
          sql`EXISTS (SELECT 1 FROM ${teams} t WHERE t.id = ${teamMembers.teamId}
                      AND t.status IN ('forming','ready','playing'))`,
        ),
      )
      .returning({ id: teamMembers.id });
    return result.length > 0;
  } catch {
    // DB 失敗不阻斷重連；玩家仍在記憶體房間，下次 join 會再試
    return false;
  }
}

export { REJOINABLE_TEAM_STATUSES };
