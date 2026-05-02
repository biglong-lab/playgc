// 📺 PollLivePage — GamePageRenderer 用此元件對應 pageType="host_poll_live"
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// 取得 hostMode：根據 URL 路徑（/host/* → true，/play/* → false）

import { useState, useRef } from "react";
import PollLive, { type PollLiveConfig } from "./PollLive";
import type { Page } from "@shared/schema";

interface PollLivePageProps {
  page: Page;
}

// state 型別（與 PollLive.tsx 內部對齊；因為 onBroadcastState 是 internal type，
// 這裡用 unknown → cast 給元件，元件內 type narrow）
type PollLiveStateShape = Parameters<NonNullable<React.ComponentProps<typeof PollLive>["onBroadcastState"]>>[0];

export default function PollLivePage({ page }: PollLivePageProps) {
  // 從路徑判斷是大螢幕還是玩家端
  const isHostMode = window.location.pathname.startsWith("/host/");
  const [state, setState] = useState<PollLiveStateShape | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // page.config 是 jsonb 欄位（schema 是 unknown）— 抽 config 並 fallback 為空
  const config: PollLiveConfig =
    (page.config as { config?: PollLiveConfig })?.config ??
    (page.config as PollLiveConfig | undefined) ?? {
      question: "請投票",
      options: [
        { id: "a", label: "選項 A" },
        { id: "b", label: "選項 B" },
      ],
    };

  // 訂閱父層 WS 訊息：W2 D2 會抽 useHostScreenSync hook 取代此處的 wsRef.current
  // 目前簡化：state 透過父層的 host_screen_state 注入（HostScreen.tsx 訂閱後 dispatch）

  return (
    <PollLive
      config={config}
      hostMode={isHostMode}
      state={state}
      onPulse={(pulseType, payload) => {
        wsRef.current?.send(JSON.stringify({
          type: "host_screen_pulse",
          sessionId: getHostSessionIdFromUrl(),
          pulseType,
          payload,
        }));
      }}
      onBroadcastState={(newState) => {
        setState(newState);
        wsRef.current?.send(JSON.stringify({
          type: "host_screen_state",
          sessionId: getHostSessionIdFromUrl(),
          state: newState,
        }));
      }}
    />
  );
}

function getHostSessionIdFromUrl(): string {
  const match = window.location.pathname.match(/^\/(host|play)\/([^/]+)/);
  return match?.[2] ?? "";
}
