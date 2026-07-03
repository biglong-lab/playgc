// 🗳️ VoteTeam — 隊伍投票元件（多人協作版）
//
// 與個人版 VotePage 的差異：
//   - 隊內所有玩家投票進度即時同步（透過 WebSocket vote_cast 事件）
//   - 三種完成條件（依 votingMode）：
//       majority    — 過半隊員投完（含同意/任意選項）即可前進
//       unanimous   — 全員投完才能前進
//       display     — 純展示計票，投完自己票就可前進（不卡）
//   - 顯示「投票進度 N/M」+ 隊友狀態
//
// 後端依賴：server/routes/team-votes.ts（API 完整，依 VOTE_SYNC_PLAN.md）
//   - POST /api/teams/:teamId/votes — 建立投票（首位玩家自動建）
//   - POST /api/votes/:voteId/cast — 投票
//   - WebSocket: vote_created / vote_cast 廣播
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.2
//
// 測試友善：所有後端互動透過 props 注入（onCastVote / onEnsureVote），
// 元件本身為「準 presentational」，便於單元測試。

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Vote as VoteIcon, Users, Loader2 } from "lucide-react";
import type { VoteConfig } from "@shared/schema";

// ============================================================================
// 型別
// ============================================================================

/** 投票模式 — 對應後端 team-votes.ts 的 votingMode */
export type VotingMode = "majority" | "unanimous" | "display";

/** 隊伍投票即時狀態（從 server / WebSocket 更新） */
export interface TeamVoteState {
  /** 投票紀錄（每個 ballot 一個 entry） */
  ballots: Array<{
    userId: string;
    optionIndex: number;
    votedAt: string;
  }>;
  /** 隊伍總人數（計算過半 / 全員的分母） */
  totalMembers: number;
  /** 投票模式 */
  votingMode: VotingMode;
}

export interface VoteTeamProps {
  config: VoteConfig;
  /** 自己的 user id（用於判斷是否已投） */
  myUserId: string;
  /** 隊伍 id（用於建立投票 / 投票 API） */
  teamId: string;
  /** 即時狀態（父層由 WebSocket 注入，預設 undefined 表示尚未建立） */
  voteState?: TeamVoteState;
  /** 確保投票存在（首位呼叫此 callback 建立 server-side vote）— 父層實作 idempotent */
  onEnsureVote?: () => void | Promise<void>;
  /** 玩家投票（父層實作呼叫 server API + 等待 WebSocket 廣播） */
  onCastVote: (optionIndex: number) => void | Promise<void>;
  /** 達標時呼叫 — 父層處理 page 前進 */
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

// ============================================================================
// 純函式 helpers（可單獨測試）
// ============================================================================

/** 計算各選項票數 + 百分比 */
export function computeVoteResults(
  ballots: TeamVoteState["ballots"],
  optionCount: number,
): Array<{ optionIndex: number; count: number; percentage: number }> {
  const counts = new Array(optionCount).fill(0) as number[];
  ballots.forEach((b) => {
    if (b.optionIndex >= 0 && b.optionIndex < optionCount) {
      counts[b.optionIndex] += 1;
    }
  });
  const total = ballots.length;
  return counts.map((count, optionIndex) => ({
    optionIndex,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

/** 判斷是否已達投票完成條件 */
export function isVotingComplete(state: TeamVoteState | undefined): boolean {
  if (!state) return false;
  const votedCount = state.ballots.length;
  switch (state.votingMode) {
    case "unanimous":
      return votedCount >= state.totalMembers;
    case "majority":
      // 🛡️ 2026-07-04 多人穩定性 Phase A2：改與 server 一致（team-votes.ts 用 ceil(n/2)）
      //   原本 `> n/2` 在偶數人數時比 server 多要 1 票 → 兩端完成判定不同步
      return votedCount >= Math.ceil(state.totalMembers / 2);
    case "display":
      // display 模式：每位玩家投完自己票就可前進，不卡集體
      return votedCount > 0;
  }
}

/** 取得「投票進度」標籤文字（給 UI 顯示） */
export function getProgressLabel(state: TeamVoteState | undefined): string {
  if (!state) return "等待建立投票...";
  const { ballots, totalMembers, votingMode } = state;
  const votedCount = ballots.length;
  switch (votingMode) {
    case "unanimous":
      return `${votedCount} / ${totalMembers} 人已投票（需全員）`;
    case "majority":
      return `${votedCount} / ${totalMembers} 人已投票（需過半）`;
    case "display":
      return `${votedCount} / ${totalMembers} 人已投票`;
  }
}

/** 取得贏家選項 index（最高票，平手取最早 index） */
export function getWinnerIndex(
  ballots: TeamVoteState["ballots"],
  optionCount: number,
): number {
  const counts = new Array(optionCount).fill(0) as number[];
  ballots.forEach((b) => {
    if (b.optionIndex >= 0 && b.optionIndex < optionCount) {
      counts[b.optionIndex] += 1;
    }
  });
  let winnerIndex = 0;
  let maxCount = -1;
  counts.forEach((c, i) => {
    if (c > maxCount) {
      maxCount = c;
      winnerIndex = i;
    }
  });
  return winnerIndex;
}

// ============================================================================
// 主元件
// ============================================================================

export default function VoteTeam({
  config,
  myUserId,
  teamId,
  voteState,
  onEnsureVote,
  onCastVote,
  onComplete,
}: VoteTeamProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const ensuredRef = useRef(false);

  const options = config.options ?? [];

  // 首次掛載 → 確保 server-side 投票存在（idempotent）
  useEffect(() => {
    if (ensuredRef.current || !onEnsureVote) return;
    ensuredRef.current = true;
    void onEnsureVote();
  }, [onEnsureVote]);

  // 是否已投票
  const hasVoted = useMemo(() => {
    if (!voteState) return false;
    return voteState.ballots.some((b) => b.userId === myUserId);
  }, [voteState, myUserId]);

  // 計票結果 + 完成條件
  const results = useMemo(
    () => (voteState ? computeVoteResults(voteState.ballots, options.length) : []),
    [voteState, options.length],
  );
  const totalVotes = voteState?.ballots.length ?? 0;
  const isComplete = useMemo(() => isVotingComplete(voteState), [voteState]);
  const progressLabel = useMemo(() => getProgressLabel(voteState), [voteState]);

  // 達標 → 自動前進
  // 用 ref + setHasAdvanced 在 setTimeout 內部，避免 hasAdvanced 變化時 cleanup 取消 timer
  useEffect(() => {
    if (!isComplete || hasAdvanced || !voteState) return;

    const winnerIndex = getWinnerIndex(voteState.ballots, options.length);
    const strategy = config.nextPageStrategy ?? "winner";
    const myBallot = voteState.ballots.find((b) => b.userId === myUserId);
    const targetIndex =
      strategy === "self" && myBallot ? myBallot.optionIndex : winnerIndex;
    const nextPageId = options[targetIndex]?.nextPageId;

    // 給玩家 1 秒看結果再前進；setHasAdvanced 放 callback 內
    // 才不會在 setHasAdvanced 觸發 re-render 時讓 cleanup 取消 timer
    const timer = setTimeout(() => {
      setHasAdvanced(true);
      onComplete(undefined, nextPageId);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isComplete, hasAdvanced, voteState, options, config.nextPageStrategy, myUserId, onComplete]);

  const handleVote = async (optionIndex: number) => {
    if (hasVoted || isSubmitting) return;
    setSelectedOption(optionIndex);
    setIsSubmitting(true);
    try {
      await onCastVote(optionIndex);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (options.length === 0) {
    return (
      <Card data-testid="vote-team-empty">
        <CardContent className="p-6 text-center text-muted-foreground">
          尚無投票選項
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4"
      data-testid="vote-team"
      role="region"
      aria-label="多人投票"
    >
      {/* 標題 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <VoteIcon className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">{config.title ?? "隊伍投票"}</h2>
          </div>
          <p className="text-foreground">{config.question}</p>
        </CardContent>
      </Card>

      {/* 進度列 */}
      <div className="flex items-center justify-between text-sm" data-testid="vote-team-progress">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{progressLabel}</span>
        </div>
        {hasVoted && (
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            你已投票
          </Badge>
        )}
      </div>

      {/* 選項 */}
      <div className="space-y-2">
        {options.map((option, idx) => {
          const result = results[idx];
          const isSelected = selectedOption === idx;
          const isMine = voteState?.ballots.find((b) => b.userId === myUserId)?.optionIndex === idx;
          return (
            <Button
              key={idx}
              variant={isMine ? "default" : "outline"}
              className="w-full justify-start h-auto py-3 px-4 text-left"
              onClick={() => handleVote(idx)}
              disabled={hasVoted || isSubmitting}
              data-testid={`vote-team-option-${idx}`}
            >
              <div className="flex-1 flex items-center justify-between gap-2">
                <span className="font-medium">{option.text}</span>
                <div className="flex items-center gap-2">
                  {isSubmitting && isSelected && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {voteState && (config.showResults ?? true) && (
                    <span className="text-sm font-number tabular-nums text-muted-foreground">
                      {result?.count ?? 0} 票（{result?.percentage ?? 0}%）
                    </span>
                  )}
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      {/* 進度條 */}
      {voteState && (
        <Progress
          value={voteState.totalMembers > 0 ? (totalVotes / voteState.totalMembers) * 100 : 0}
          className="h-2"
          data-testid="vote-team-overall-progress"
        />
      )}

      {/* 完成提示 */}
      {isComplete && !hasAdvanced && (
        <div className="text-center text-sm text-success" data-testid="vote-team-complete">
          ✓ 投票結束，前進中...
        </div>
      )}
    </motion.div>
  );
}
