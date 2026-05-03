// 📺 ScoreboardAnnouncementPage — GamePageRenderer 對應 pageType="host_scoreboard_announcement"

import { useMemo } from "react";
import ScoreboardAnnouncement, { type ScoreboardAnnouncementConfig } from "./ScoreboardAnnouncement";
import { useHostScreenSync } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface ScoreboardAnnouncementPageProps {
  page: Page;
}

interface AnnouncementEntry {
  id: string;
  text: string;
  type: "score" | "info" | "celebrate";
  ts: number;
}

interface ScoreboardAnnouncementStateShape {
  announcements: AnnouncementEntry[];
}

export default function ScoreboardAnnouncementPage({ page }: ScoreboardAnnouncementPageProps) {
  // 用 useMemo 穩定 config 物件 identity（與其他 host pages 一致 pattern；防子元件 props 每次 render 變化）
  const config = useMemo<ScoreboardAnnouncementConfig>(() => {
    const raw = (page.config as { config?: ScoreboardAnnouncementConfig } | ScoreboardAnnouncementConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as ScoreboardAnnouncementConfig | null)) ?? {};
  }, [page.config]);

  // 此元件設計上 admin 從 host 端表單主動 broadcastState，不接受玩家 pulse
  // → 用 useHostScreenSync（基本版）即可
  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSync<ScoreboardAnnouncementStateShape>();

  return (
    <ScoreboardAnnouncement
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
