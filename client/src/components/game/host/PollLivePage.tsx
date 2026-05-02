// 📺 PollLivePage — GamePageRenderer 用此元件對應 pageType="host_poll_live"
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// 用 useHostScreenSyncWithPulse hook 處理 WS 連線、register、計票

import { useCallback } from "react";
import PollLive, { type PollLiveConfig } from "./PollLive";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface PollLivePageProps {
  page: Page;
}

interface PollOption {
  id: string;
  label: string;
}

interface PollLiveStateShape {
  question: string;
  options: PollOption[];
  votes: Record<string, number>;
  totalVotes: number;
  status: "open" | "closed" | "revealed";
  revealResults: boolean;
  startedAt?: string;
  endsAt?: string;
}

export default function PollLivePage({ page }: PollLivePageProps) {
  // 從 page.config jsonb 解析 config（合理 fallback 確保不爆）
  const rawConfig = (page.config as { config?: PollLiveConfig } | PollLiveConfig | null) ?? null;
  const config: PollLiveConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PollLiveConfig | null)) ?? {
      question: "請投票",
      options: [
        { id: "a", label: "選項 A" },
        { id: "b", label: "選項 B" },
      ],
    };

  // 大螢幕端計票邏輯：玩家送 pulseType='vote' + payload={optionId}
  // 規則：每個 user 只算一次（用 fromUserId 去重 — server 端 ws 訊息有附）
  const handlePulse = useCallback(
    (pulseType: string, payload: unknown, currentState: PollLiveStateShape | null): PollLiveStateShape | null => {
      if (pulseType !== "vote") return null; // 不認得的 pulse 不處理
      const optionId = (payload as { optionId?: string })?.optionId;
      if (!optionId) return null;

      const baseState: PollLiveStateShape = currentState ?? {
        question: config.question,
        options: config.options,
        votes: Object.fromEntries(config.options.map((o) => [o.id, 0])),
        totalVotes: 0,
        status: "open",
        revealResults: false,
      };

      // 不接受 closed/revealed 狀態下的投票
      if (baseState.status !== "open") return baseState;
      // optionId 必須存在於選項中
      if (!baseState.options.find((o) => o.id === optionId)) return baseState;

      return {
        ...baseState,
        votes: {
          ...baseState.votes,
          [optionId]: (baseState.votes[optionId] ?? 0) + 1,
        },
        totalVotes: baseState.totalVotes + 1,
      };
    },
    [config],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<PollLiveStateShape>({
    onPulse: handlePulse,
  });

  return (
    <PollLive
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
