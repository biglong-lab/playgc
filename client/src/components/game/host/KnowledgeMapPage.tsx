// 🗺️ KnowledgeMapPage — GamePageRenderer 對應 pageType="host_knowledge_map"

import { useMemo } from "react";
import KnowledgeMap, { type KnowledgeMapConfig } from "./KnowledgeMap";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import { useMyUserName } from "@/hooks/useMyUserName";
import type { Page } from "@shared/schema";

interface KnowledgeMapPageProps {
  page: Page;
  myUserName?: string;
}

interface VisitEntry {
  id: string;
  pointId: string;
  name: string;
  message?: string;
  ts: number;
}

interface KnowledgeMapStateShape {
  visits: VisitEntry[];
}

interface VisitPulse {
  pointId: string;
  name: string;
  message?: string;
}

function reduceVisit(
  current: KnowledgeMapStateShape | null,
  pulse: VisitPulse,
  maxVisits: number,
): KnowledgeMapStateShape {
  const base: KnowledgeMapStateShape = current ?? { visits: [] };
  const newEntry: VisitEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pointId: pulse.pointId,
    name: pulse.name,
    message: pulse.message,
    ts: Date.now(),
  };
  const visits = [...base.visits, newEntry].slice(-maxVisits);
  return { visits };
}

export default function KnowledgeMapPage({ page, myUserName: propUserName }: KnowledgeMapPageProps) {
  // W14 D3: hook 優先 → 既有 prop fallback（向下相容）
  const lineName = useMyUserName();
  const myUserName = lineName || propUserName;
  // 用 useMemo 穩定 config 物件 identity（與其他 host pages 一致 pattern）
  const config = useMemo<KnowledgeMapConfig>(() => {
    const raw = (page.config as { config?: KnowledgeMapConfig } | KnowledgeMapConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as KnowledgeMapConfig | null)) ?? {};
  }, [page.config]);
  const maxVisits = config.maxVisits ?? 200;

  const { state, sendPulse, hostMode } = useHostScreenSyncWithPulse<KnowledgeMapStateShape>({
    onPulse: (pulseType, payload, currentState) => {
      if (pulseType === "visit") {
        return reduceVisit(currentState, payload as VisitPulse, maxVisits);
      }
      return null;
    },
  });

  return (
    <KnowledgeMap
      config={config}
      hostMode={hostMode}
      myUserName={myUserName}
      state={state}
      onPulse={sendPulse}
    />
  );
}
