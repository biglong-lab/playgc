// 📺 GuestbookDigitalPage — GamePageRenderer 對應 pageType="host_guestbook_digital"

import { useCallback, useMemo } from "react";
import GuestbookDigital, { type GuestbookDigitalConfig } from "./GuestbookDigital";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import { useAuth } from "@/hooks/useAuth";
import { useMyUserName } from "@/hooks/useMyUserName";
import type { Page } from "@shared/schema";

interface GuestbookDigitalPageProps {
  page: Page;
}

interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  ts: number;
}

interface GuestbookDigitalStateShape {
  entries: GuestbookEntry[];
}

const MAX_ENTRIES = 200;

export default function GuestbookDigitalPage({ page }: GuestbookDigitalPageProps) {
  // W14 D3: LINE 名字優先 → admin 帳號 fallback
  const lineName = useMyUserName();
  const { user } = useAuth();
  const myUserName = lineName || user?.firstName || user?.email?.split("@")[0] || "";

  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<GuestbookDigitalConfig>(() => {
    const raw = (page.config as { config?: GuestbookDigitalConfig } | GuestbookDigitalConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as GuestbookDigitalConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: GuestbookDigitalStateShape | null,
    ): GuestbookDigitalStateShape | null => {
      if (pulseType !== "sign") return null;
      const p = payload as { name?: string; message?: string };
      if (!p?.name || !p?.message) return null;

      const baseState: GuestbookDigitalStateShape = currentState ?? { entries: [] };
      const newEntry: GuestbookEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: p.name.slice(0, 30),
        message: p.message.slice(0, 200),
        ts: Date.now(),
      };
      const entries = [...baseState.entries, newEntry].slice(-MAX_ENTRIES);
      return { entries };
    },
    [],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<GuestbookDigitalStateShape>({
    onPulse: handlePulse,
  });

  return (
    <GuestbookDigital
      config={config}
      hostMode={hostMode}
      state={state}
      myUserName={myUserName}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
