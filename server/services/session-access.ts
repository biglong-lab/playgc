// 🔐 場次存取權（2026-09-22 業主：「要補上檢查」— 既有 IDOR）
//
// 問題：PATCH /api/sessions/:id 原本只要登入就能改任何場次（標記完成 / 改分數），
//   配合訪客自動建立身分，任何人都能替別人的場次觸發完成、成就、戰績。
// 規則：呼叫者必須是這一場的參賽者 ——
//   1. 在此場次有自己的進度（POST /api/sessions 建立者、進度 PATCH 過的隊員）
//   2. 或是此場次對應隊伍的成員（隊伍共用場次：剛開賽還沒進度也算）
import { and, eq, sql } from "drizzle-orm";
import { teamMembers, teamSessions } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";

export async function isSessionParticipant(sessionId: string, userId: string): Promise<boolean> {
  if (!sessionId || !userId) return false;
  const progress = await storage.getPlayerProgressByUser(sessionId, userId);
  if (progress) return true;

  const rows = await db
    .select({ one: sql<number>`1` })
    .from(teamSessions)
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teamSessions.teamId), eq(teamMembers.userId, userId)),
    )
    .where(eq(teamSessions.sessionId, sessionId))
    .limit(1);
  return rows.length > 0;
}
