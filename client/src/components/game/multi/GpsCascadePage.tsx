// 🗺 GpsCascadePage — GamePageRenderer 對應 pageType="gps_cascade"
// W4 D2 簡化版：本地 state，下輪 D5 接 useTeamGpsCascadeSync hook

import { useState } from "react";
import GpsCascade, { type GpsCascadeConfig } from "./GpsCascade";
import type { Page } from "@shared/schema";

interface GpsCascadePageProps {
  page: Page;
}

interface GpsCascadeState {
  reachedPointIds: string[];
}

export default function GpsCascadePage({ page }: GpsCascadePageProps) {
  const rawConfig = (page.config as { config?: GpsCascadeConfig } | GpsCascadeConfig | null) ?? null;
  const config: GpsCascadeConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GpsCascadeConfig | null)) ?? {
      title: "🗺 金門古蹟巡禮",
      subtitle: "依序探訪、解鎖故事",
      points: [
        {
          id: "p1",
          name: "後浦老街",
          hint: "找到入口的牌樓，看到「後浦」兩個字",
          story: "後浦老街是金門最早的商業聚落，早期是兩岸貿易的重要中心。",
        },
        {
          id: "p2",
          name: "賈村牌坊",
          hint: "從後浦老街往南走 200m，會看到一座雙層牌坊",
          story: "賈村牌坊是清代節孝坊，紀念當地一位守節的女子。",
        },
        {
          id: "p3",
          name: "莒光樓",
          hint: "金門最具代表性的建築，從南方海岸看過去",
          story: "莒光樓於 1953 年建成，象徵反共復國精神，現為金門地標。",
        },
      ],
    };

  const [state, setState] = useState<GpsCascadeState>({ reachedPointIds: [] });

  const handleReach = (pointId: string) => {
    setState((prev) => ({
      reachedPointIds: prev.reachedPointIds.includes(pointId)
        ? prev.reachedPointIds
        : [...prev.reachedPointIds, pointId],
    }));
  };

  return <GpsCascade config={config} state={state} onReachPoint={handleReach} />;
}
