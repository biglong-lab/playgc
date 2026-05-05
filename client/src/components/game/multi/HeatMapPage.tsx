import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import HeatMap, { HeatMapConfig, HeatMapState, HeatVote } from "./HeatMap";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: HeatMapState = { votes: [], revealed: false };

export default function HeatMapPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<HeatMapState>({
    gameId,
    sessionId,
    pageId,
    type: "heat_map",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const config = (raw as Record<string, unknown>)["rowLabels"] !== undefined
    ? raw as unknown as HeatMapConfig
    : ((raw as Record<string, unknown>).config as unknown as HeatMapConfig) ?? {
        title: "熱區投票",
        rowLabels: ["高", "低"],
        colLabels: ["快", "慢"],
      };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleVote(row: number, col: number) {
    const already = state.votes.some((v) => v.userId === myUserId);
    if (already) return;
    const vote: HeatVote = {
      voteId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      row,
      col,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <HeatMap
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
