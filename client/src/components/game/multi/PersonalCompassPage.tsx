import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import PersonalCompass, { PersonalCompassConfig, PersonalCompassState, CompassCard } from "./PersonalCompass";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: PersonalCompassState = { cards: [], revealed: false };

export default function PersonalCompassPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PersonalCompassState>({
    gameId,
    sessionId,
    pageId,
    type: "personal_compass",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: PersonalCompassConfig =
    "northLabel" in r
      ? (r as unknown as PersonalCompassConfig)
      : r.config && "northLabel" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as PersonalCompassConfig)
        : { title: "🧭 個人指南針", northLabel: "N 優勢", southLabel: "S 挑戰", eastLabel: "E 機會", westLabel: "W 障礙" };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(north: string, south: string, east: string, west: string) {
    const already = state.cards.some((c) => c.userId === myUserId);
    if (already) return;
    const card: CompassCard = {
      cardId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      north,
      south,
      east,
      west,
    };
    updateState({ ...state, cards: [...state.cards, card] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <PersonalCompass
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
