// 📺 TriviaShowdownPage — GamePageRenderer 對應 pageType="host_trivia_showdown"
//
// 🆕 Phase 4 (2026-05-08)：server-side scoring
//   - 玩家答題改 POST /api/trivia/:sessionId/answer（不走 ws pulse）
//   - server 寫 DB + 算 rank + score + broadcast host_screen_state
//   - client 端 onPulse 不再算分（保留接收 server 廣播的 state）
//   - ADR-0018 規則 4：計分 → server-side source-of-truth

import { useEffect, useMemo, useState } from "react";
import TriviaShowdown, { type TriviaShowdownConfig } from "./TriviaShowdown";
import { useHostScreenSync } from "../shared/hooks/useHostScreenSync";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useAuth } from "@/hooks/useAuth";
import { useMyUserName } from "@/hooks/useMyUserName";
import type { Page } from "@shared/schema";

interface TriviaShowdownPageProps {
  page: Page;
}

interface AnswerRecord {
  choice: number;
  ts: number;
}

interface TriviaShowdownStateShape {
  currentQuestionIdx: number;
  status: "intro" | "question" | "answering" | "revealed" | "ended";
  answered: Record<string, AnswerRecord>;
  scores: Record<string, number>;
  questionStartedAt?: number;
}

/**
 * 從 URL 解析 sessionId（與 useHostScreenSync 內部相同邏輯、避免改 hook 介面）
 */
function parseSessionIdFromUrl(): string {
  const path = window.location.pathname;
  const hostMatch = path.match(/^\/host\/([^/]+)/);
  const playMatch = path.match(/^\/play\/([^/]+)/);
  return hostMatch?.[1] ?? playMatch?.[1] ?? "";
}

export default function TriviaShowdownPage({ page }: TriviaShowdownPageProps) {
  // W14 D3: LINE 名字優先 → admin 帳號 fallback → 匿名
  const lineName = useMyUserName();
  const { user } = useAuth();
  const myUserName = lineName || user?.firstName || user?.email?.split("@")[0] || "匿名";
  const myUserId = user?.id ?? "";
  const sessionId = useMemo(() => parseSessionIdFromUrl(), []);

  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<TriviaShowdownConfig>(() => {
    const raw = (page.config as { config?: TriviaShowdownConfig } | TriviaShowdownConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as TriviaShowdownConfig | null)) ?? {
      title: "🏆 知識搶答",
      questions: [
        {
          id: "q1",
          prompt: "金門最大的紀念日是？",
          options: ["823 砲戰", "古寧頭戰役", "921 大地震", "雙十國慶"],
          correctIdx: 0,
          timeLimitSec: 15,
        },
        {
          id: "q2",
          prompt: "金門特產之一（飲品）？",
          options: ["金門蜜棗", "金門高粱酒", "金門麻油", "金門綠豆湯"],
          correctIdx: 1,
          timeLimitSec: 15,
        },
      ],
    };
  }, [page.config]);

  // 🆕 Phase 4：用基本版 useHostScreenSync（不再需要 onPulse 算分）
  // 玩家答題直接 POST 給 server、server 端算分 + broadcast host_screen_state
  // 大螢幕 host 端從 state（server 廣播）拿到 answered + scores
  const { state, sendPulse, broadcastState, hostMode } =
    useHostScreenSync<TriviaShowdownStateShape>();

  return (
    <TriviaShowdown
      config={config}
      hostMode={hostMode}
      state={state}
      myUserName={myUserName}
      sessionId={sessionId}
      myUserId={myUserId}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
