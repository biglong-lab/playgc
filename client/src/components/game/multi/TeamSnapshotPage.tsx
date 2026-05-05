import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import TeamSnapshot, { TeamSnapshotConfig, TeamSnapshotState, SnapshotCard } from "./TeamSnapshot";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: TeamSnapshotState = { cards: [], revealed: false };

export default function TeamSnapshotPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamSnapshotState>({
    gameId,
    sessionId,
    pageId,
    type: "team_snapshot",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: TeamSnapshotConfig =
    "fields" in r && Array.isArray(r.fields)
      ? (r as unknown as TeamSnapshotConfig)
      : r.config && "fields" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as TeamSnapshotConfig)
        : { title: "團隊快照", fields: ["開心的事", "擔心的事", "需要支援"], maxLength: 50 };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(answers: Record<string, string>) {
    const already = state.cards.some((c) => c.userId === myUserId);
    if (already) return;
    const card: SnapshotCard = {
      cardId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      answers,
    };
    updateState({ ...state, cards: [...state.cards, card] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TeamSnapshot
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
