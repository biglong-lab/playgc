// 🗳️ team-vote-eval — 投票完成判定（server 權威、單一事實來源）
//
// 背景（CHITO #8687281e 2026-07-08）：
//   投票完成判定原本 server / client 各算一份，client 用各裝置的 my-team
//   快取當分母（10s 才刷新）→ 成員異動瞬間各裝置分母不一致 → 有人提早判定
//   完成前進 → advance-progress 把全隊拖到下一頁（1/3 票就跳頁）。
//   修法：完成判定只信 server（此模組），client 只顯示進度、等 server 訊號。
//
// 兩個進入點：
//   computeVoteCompletion — 純函式（單元測試友善）
//   reevaluateTeamVotes  — 成員離開（自願 / leader-decide / auto-leave）後
//                          重算該隊所有 active 投票；若因分母變小而達標，
//                          補寫 completed + 廣播 vote_completed（否則投票永久卡住）

import { db } from "../db";
import { teamVotes, teamVoteBallots, teamMembers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WsBroadcastMessage } from "../routes/types";

export interface VoteCompletionResult {
  isComplete: boolean;
  winningOptionId: string | null;
  voteCounts: Record<string, number>;
}

/**
 * 計算投票是否完成（與 team-votes.ts cast 端點同一套規則）
 *
 * @param votingMode  "unanimous" 全員同選項 / 其他（majority）過半或全員投完取最高
 * @param ballotOptionIds 已投的 optionId 列表
 * @param totalMembers 現任成員數（leftAt 為 null）
 */
export function computeVoteCompletion(
  votingMode: string,
  ballotOptionIds: string[],
  totalMembers: number,
): VoteCompletionResult {
  const voteCounts: Record<string, number> = {};
  for (const optId of ballotOptionIds) {
    voteCounts[optId] = (voteCounts[optId] || 0) + 1;
  }

  // 分母為 0（隊伍已無人）→ 不判完成，避免除零與無意義前進
  if (totalMembers <= 0) {
    return { isComplete: false, winningOptionId: null, voteCounts };
  }

  let isComplete = false;
  let winningOptionId: string | null = null;

  if (votingMode === "unanimous") {
    if (ballotOptionIds.length >= totalMembers) {
      const optIds = Object.keys(voteCounts);
      if (optIds.length === 1 && voteCounts[optIds[0]] >= totalMembers) {
        isComplete = true;
        winningOptionId = optIds[0];
      }
    }
  } else {
    const majorityNeeded = Math.ceil(totalMembers / 2);
    for (const [optId, count] of Object.entries(voteCounts)) {
      if (count >= majorityNeeded) {
        isComplete = true;
        winningOptionId = optId;
        break;
      }
    }
    // 全員投完但無過半（平票分散）→ 取最高票
    if (!isComplete && ballotOptionIds.length >= totalMembers) {
      isComplete = true;
      let maxVotes = 0;
      for (const [optId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          winningOptionId = optId;
        }
      }
    }
  }

  return { isComplete, winningOptionId, voteCounts };
}

/**
 * 成員離開後重算該隊所有 active 投票
 *
 * 情境：3 人隊 2 人已投（需 2 票、未達）→ 第 3 人離開 → 分母變 2、
 *       門檻變 1 → 其實已達標，但沒有新的 cast 事件觸發重算 → 永久卡住。
 * 呼叫點：leave 路由、leader-decide continue、ws auto-leave。
 * 失敗不 throw（fire-and-forget，不阻塞離開流程）。
 */
export async function reevaluateTeamVotes(
  teamId: string,
  broadcastToTeam: (teamId: string, message: WsBroadcastMessage) => void,
): Promise<void> {
  try {
    const activeVotes = await db.query.teamVotes.findMany({
      where: and(eq(teamVotes.teamId, teamId), eq(teamVotes.status, "active")),
      with: { ballots: true },
    });
    if (activeVotes.length === 0) return;

    const members = await db.query.teamMembers.findMany({
      where: and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)),
    });
    const memberIds = new Set(members.map((m) => m.userId));

    for (const vote of activeVotes) {
      // 只計現任成員的票（離開者的票不算進分子，避免幽靈票灌高）
      const validBallots = vote.ballots.filter((b) => memberIds.has(b.userId));
      const result = computeVoteCompletion(
        vote.votingMode ?? "majority",
        validBallots.map((b) => b.optionId),
        memberIds.size,
      );
      if (!result.isComplete || !result.winningOptionId) continue;

      await db
        .update(teamVotes)
        .set({
          status: "completed",
          winningOptionId: result.winningOptionId,
          completedAt: new Date(),
        })
        .where(eq(teamVotes.id, vote.id));

      broadcastToTeam(teamId, {
        type: "vote_completed",
        voteId: vote.id,
        winningOptionId: result.winningOptionId,
        voteCounts: result.voteCounts,
        reason: "member_left_reevaluate",
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // 重算失敗不阻塞主流程；下一次 cast 或 polling 仍能推進
  }
}
