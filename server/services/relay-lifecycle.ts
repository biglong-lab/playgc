// 🏃 接力生命週期（2026-09-23 業主：接力依頁面分段）
//
// 規則：
//   - 遊戲設定 games.match_config.relaySegments = 每一棒負責的頁碼區間（1-based、含頭尾）
//   - 一場接力賽事＝一隊；一人一棒，參賽人數 = 分段數（開賽前檢查）
//   - 開賽 → 依加入順序分配棒次，第 1 棒 active、其餘 pending
//   - 當棒玩家完成自己那段（遊戲場次完成）→ 自動交棒給下一棒；最後一棒完成 → 結算
//   - 取代舊的 /relay/assign（房主手動分段）與 /relay/handoff（前端指定下一棒、未驗證）
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { gameMatches, games, matchParticipants, resolveMatchConfig, type GameMatchConfig } from "@shared/schema";
import type { MatchBroadcast } from "./match-lifecycle";

export interface RelayLeg {
  segment: number;
  fromPage: number;
  toPage: number;
}

/** 遊戲的接力分段（沒設定 = 空陣列，不能開接力賽） */
export async function loadRelayLegs(gameId: string): Promise<RelayLeg[]> {
  const [game] = await db.select({ matchConfig: games.matchConfig }).from(games).where(eq(games.id, gameId));
  const { relaySegments } = resolveMatchConfig(game?.matchConfig as GameMatchConfig | null);
  return relaySegments.map((s, i) => ({ segment: i + 1, fromPage: s.fromPage, toPage: s.toPage }));
}

/** 開賽：依加入順序分配棒次 */
export async function activateFirstRelayLeg(matchId: string): Promise<void> {
  const participants = await db
    .select()
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(asc(matchParticipants.joinedAt));
  await Promise.all(
    participants.map((p, i) =>
      db
        .update(matchParticipants)
        .set({ relaySegment: i + 1, relayStatus: i === 0 ? "active" : "pending" })
        .where(eq(matchParticipants.id, p.id)),
    ),
  );
}

/** 當棒完成 → 交給下一棒；沒有下一棒 → 結算（只有 active 的棒能交，冪等） */
export async function handoffAfterLeg(matchId: string, participantId: string, broadcast: MatchBroadcast): Promise<void> {
  const [done] = await db
    .update(matchParticipants)
    .set({ relayStatus: "completed" })
    .where(and(eq(matchParticipants.id, participantId), eq(matchParticipants.relayStatus, "active")))
    .returning();
  if (!done?.relaySegment) return;

  const [next] = await db
    .select()
    .from(matchParticipants)
    .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.relaySegment, done.relaySegment + 1)));

  const { finishMatch, loadMatchRanking } = await import("./match-lifecycle");
  if (!next) {
    await finishMatch(matchId, broadcast, "relay_completed");
    return;
  }
  await db.update(matchParticipants).set({ relayStatus: "active" }).where(eq(matchParticipants.id, next.id));
  broadcast(matchId, {
    type: "relay_handoff",
    fromSegment: done.relaySegment,
    toSegment: next.relaySegment,
    toUserId: next.userId,
    ranking: await loadMatchRanking(matchId),
    timestamp: new Date().toISOString(),
  });
}

export interface MyRelayLeg {
  status: "pending" | "active" | "completed" | "spectator";
  segment: number | null;
  totalSegments: number;
  fromPage: number | null;
  toPage: number | null;
  /** 目前當棒的是第幾棒（等待畫面顯示「第 N 棒進行中」） */
  activeSegment: number | null;
}

/** 我在這場接力的棒次與頁碼（遊戲頁據此只給玩自己那段 / 顯示等待畫面） */
export async function getMyRelayLeg(matchId: string, userId: string): Promise<MyRelayLeg | null> {
  const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
  if (!match || match.matchMode !== "relay") return null;
  const legs = await loadRelayLegs(match.gameId);
  const participants = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
  const mine = participants.find((p) => p.userId === userId);
  const active = participants.find((p) => p.relayStatus === "active");
  const leg = mine?.relaySegment ? legs[mine.relaySegment - 1] : undefined;
  return {
    status: mine?.relaySegment ? ((mine.relayStatus as MyRelayLeg["status"]) ?? "pending") : "spectator",
    segment: mine?.relaySegment ?? null,
    totalSegments: legs.length,
    fromPage: leg?.fromPage ?? null,
    toPage: leg?.toPage ?? null,
    activeSegment: active?.relaySegment ?? null,
  };
}
