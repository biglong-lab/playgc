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
import { teamMembers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
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
