// 🗳️ useTeamVoteSync — VoteTeam 元件的後端整合 hook
//
// 用途：橋接 VoteTeam 元件（用 optionIndex 數字）與後端 API（用 optionId 字串）
//
// 後端 API（依 server/routes/team-votes.ts）：
//   - GET /api/teams/:teamId/votes — 取隊伍投票列表
//   - POST /api/teams/:teamId/votes — 建立投票（首位呼叫）
//   - POST /api/votes/:voteId/cast — 投票（body: { optionId }）
//
// 設計：
//   - 掛載時自動 GET 找 active vote（依 pageId）→ 沒有則 POST 建立（idempotent）
//   - 提供 castVote(optionIndex) → 內部轉 optionId="option_${idx}"
//   - WebSocket vote_cast / vote_created 事件由父層注入（透過 onWebSocketMessage）
//   - 回傳 voteState 給 VoteTeam 元件直接使用
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.2 + VOTE_SYNC_PLAN.md

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { TeamVoteState, VotingMode } from "../../multi/VoteTeam";
import type { VoteConfig } from "@shared/schema";

// ============================================================================
// 型別
// ============================================================================

/** Server 回傳的 vote 物件（依 teamVotes schema） */
interface ServerVote {
  id: string;
  teamId: string;
  pageId: string | null;
  title: string;
  options: Array<{ id: string; label: string; targetPageId?: string; points?: number }>;
  votingMode: string;
  status: string;
  winningOptionId?: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Server 回傳的 ballot 物件 */
interface ServerBallot {
  id: string;
  voteId: string;
  userId: string;
  optionId: string;
  createdAt: string;
}

/** WebSocket 訊息（來自 useTeamWebSocket） */
interface VoteWsMessage {
  type: string;
  vote?: ServerVote;
  voteId?: string;
  userId?: string;
  optionId?: string;
}

export interface UseTeamVoteSyncOptions {
  /** 隊伍 id */
  teamId: string;
  /** 當前 page id（綁定投票歸屬） */
  pageId: string;
  /** Vote 設定（用於 POST 建立 vote） */
  config: VoteConfig;
  /** 投票模式（預設 majority） */
  votingMode?: VotingMode;
  /** 隊伍總人數（VoteTeam 顯示「N/M」需要） */
  totalMembers: number;
  /** 是否啟用（false 時不發 request，例如未組好隊） */
  enabled?: boolean;
}

export interface UseTeamVoteSyncResult {
  /** 給 VoteTeam 直接用的狀態 */
  voteState: TeamVoteState | undefined;
  /** 投票 id（建立後才有值） */
  voteId: string | undefined;
  /** 確保 server-side 投票存在（VoteTeam 掛載時呼叫） */
  ensureVote: () => Promise<void>;
  /** 投票（optionIndex → optionId 內部轉換） */
  castVote: (optionIndex: number) => Promise<void>;
  /** 處理 WebSocket 訊息（父層收到 vote_cast/vote_created 時呼叫） */
  handleWsMessage: (msg: VoteWsMessage) => void;
  /** 🛡️ 2026-07-04 Phase A3：重連時立即重拉票數（不等 10s poll） */
  refetchNow: () => void;
  /** 是否載入中 */
  isLoading: boolean;
  /** 錯誤訊息 */
  error: string | null;
}

// ============================================================================
// 純函式 helpers（可單獨測試）
// ============================================================================

/** optionId "option_3" → 3 */
export function parseOptionIndex(optionId: string): number {
  const m = optionId.match(/^option_(\d+)$/);
  return m && m[1] ? parseInt(m[1], 10) : -1;
}

/** 3 → "option_3" */
export function buildOptionId(optionIndex: number): string {
  return `option_${optionIndex}`;
}

/** Server ballots → VoteTeam 用的 ballots（optionId → optionIndex） */
export function mapServerBallots(
  ballots: ServerBallot[],
): TeamVoteState["ballots"] {
  return ballots.map((b) => ({
    userId: b.userId,
    optionIndex: parseOptionIndex(b.optionId),
    votedAt: b.createdAt,
  }));
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 用法：
 * ```tsx
 * const { voteState, ensureVote, castVote, handleWsMessage } = useTeamVoteSync({
 *   teamId,
 *   pageId,
 *   config,
 *   totalMembers,
 * });
 *
 * // 訂閱 WebSocket（在 useTeamWebSocket 的 onVoteCast 內呼叫 handleWsMessage）
 *
 * return <VoteTeam {...} voteState={voteState} onCastVote={castVote} onEnsureVote={ensureVote} />;
 * ```
 */
export function useTeamVoteSync({
  teamId,
  pageId,
  config,
  votingMode = "majority",
  totalMembers,
  enabled = true,
}: UseTeamVoteSyncOptions): UseTeamVoteSyncResult {
  const [voteId, setVoteId] = useState<string | undefined>();
  const [ballots, setBallots] = useState<ServerBallot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ensuredRef = useRef(false);
  const voteIdRef = useRef<string | undefined>();
  voteIdRef.current = voteId;

  // 從 server 拉最新 ballots（用在 polling / reconnect）
  const fetchLatestBallots = useCallback(async (vid: string) => {
    try {
      const listRes = await apiRequest("GET", `/api/teams/${teamId}/votes`);
      const list = (await listRes.json()) as Array<ServerVote & { ballots: ServerBallot[] }>;
      const found = list.find((v) => v.id === vid);
      if (found) setBallots(found.ballots ?? []);
    } catch {}
  }, [teamId]);

  // 從 server 取現況或建立投票（idempotent）
  const ensureVote = useCallback(async () => {
    if (ensuredRef.current || !enabled) return;
    ensuredRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // 1. 找此 page 的 active vote
      const listRes = await apiRequest("GET", `/api/teams/${teamId}/votes`);
      const existing = (await listRes.json()) as Array<
        ServerVote & { ballots: ServerBallot[] }
      >;
      const found = existing.find(
        (v) => v.pageId === pageId && (v.status === "active" || v.status === "completed"),
      );

      if (found) {
        setVoteId(found.id);
        setBallots(found.ballots ?? []);
      } else {
        // 2. 沒有 → 建立
        const createRes = await apiRequest("POST", `/api/teams/${teamId}/votes`, {
          title: config.title ?? config.question,
          description: config.question,
          options: config.options.map((o) => ({
            label: o.text,
            targetPageId: o.nextPageId,
          })),
          votingMode: votingMode === "display" ? "majority" : votingMode,
          pageId,
        });
        const created = (await createRes.json()) as ServerVote;
        setVoteId(created.id);
        setBallots([]);
      }
    } catch (err) {
      ensuredRef.current = false; // 失敗允許重試
      const msg = err instanceof Error ? err.message : "建立投票失敗";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, teamId, pageId, config, votingMode]);

  // 10s polling fallback（防 WS 漏訊息）
  useEffect(() => {
    if (!enabled || !voteId) return;
    const id = setInterval(() => {
      void fetchLatestBallots(voteId);
    }, 10_000);
    return () => clearInterval(id);
  }, [enabled, voteId, fetchLatestBallots]);

  // 🛡️ 2026-07-04 多人穩定性 Phase A3：重連立即重拉（不等 10s poll）
  //   給 Page 在 ws isConnected 由 false→true 時呼叫
  const refetchNow = useCallback(() => {
    if (voteId) void fetchLatestBallots(voteId);
  }, [voteId, fetchLatestBallots]);

  // 投票
  const castVote = useCallback(
    async (optionIndex: number) => {
      if (!voteId) {
        throw new Error("投票尚未建立，無法投票");
      }
      try {
        await apiRequest("POST", `/api/votes/${voteId}/cast`, {
          optionId: buildOptionId(optionIndex),
        });
        // 樂觀更新本地（WebSocket 廣播會覆蓋確認）
        // 此處不更新 — 等 WebSocket vote_cast 事件再 setBallots
      } catch (err) {
        const msg = err instanceof Error ? err.message : "投票失敗";
        setError(msg);
        throw err;
      }
    },
    [voteId],
  );

  // 處理 WebSocket 訊息（父層收到時呼叫）
  const handleWsMessage = useCallback(
    (msg: VoteWsMessage) => {
      if (msg.type === "vote_created" && msg.vote) {
        // 別的隊員建立了投票 — 直接採用
        if (msg.vote.pageId === pageId) {
          setVoteId(msg.vote.id);
          setBallots([]);
          ensuredRef.current = true;
        }
      } else if (msg.type === "vote_cast" && msg.voteId === voteIdRef.current) {
        // 隊員投票了 — 加進 ballots
        if (msg.userId && msg.optionId) {
          setBallots((prev) => {
            if (prev.some((b) => b.userId === msg.userId)) return prev;
            return [
              ...prev,
              {
                id: `temp_${Date.now()}`,
                voteId: msg.voteId!,
                userId: msg.userId!,
                optionId: msg.optionId!,
                createdAt: new Date().toISOString(),
              },
            ];
          });
        } else if (msg.voteId) {
          // 廣播不含明細時 fallback 拉一次最新
          void fetchLatestBallots(msg.voteId);
        }
      }
    },
    [pageId, fetchLatestBallots],
  );

  // 失活時 reset
  useEffect(() => {
    if (!enabled) {
      ensuredRef.current = false;
      setVoteId(undefined);
      setBallots([]);
    }
  }, [enabled]);

  // 組裝給 VoteTeam 的 voteState
  const voteState: TeamVoteState | undefined = voteId
    ? {
        ballots: mapServerBallots(ballots),
        totalMembers,
        votingMode,
      }
    : undefined;

  return {
    voteState,
    voteId,
    ensureVote,
    castVote,
    handleWsMessage,
    refetchNow,
    isLoading,
    error,
  };
}
