// 📺 GuestbookDigitalPage — GamePageRenderer 對應 pageType="host_guestbook_digital"

import { useCallback } from "react";
import GuestbookDigital, { type GuestbookDigitalConfig } from "./GuestbookDigital";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "";

  const rawConfig = (page.config as { config?: GuestbookDigitalConfig } | GuestbookDigitalConfig | null) ?? null;
  const config: GuestbookDigitalConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GuestbookDigitalConfig | null)) ?? {};

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
