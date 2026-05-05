import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import EnergyBoost, { EnergyBoostConfig, EnergyBoostState, EnergyCard } from "./EnergyBoost";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: EnergyBoostState = { cards: [], revealed: false };

export default function EnergyBoostPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<EnergyBoostState>({
    gameId,
    sessionId,
    pageId,
    type: "energy_boost",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: EnergyBoostConfig = (r["emojis"] !== undefined
    ? r
    : r.config && (r.config as Record<string, unknown>)["emojis"] !== undefined
      ? r.config
      : {
          title: "能量加速器",
          prompt: "送出你的能量鼓勵！",
          maxLength: 40,
          emojis: ["⚡", "🔥", "💪", "🌟", "❤️"],
        }) as unknown as EnergyBoostConfig;

  const myUserId = user?.id ? String(user.id) : "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSend(toName: string, emoji: string, message: string) {
    const card: EnergyCard = {
      cardId: `${myUserId}-${Date.now()}`,
      fromUserId: myUserId,
      fromUserName: myUserName,
      toName,
      emoji,
      message,
    };
    updateState({ ...state, cards: [...state.cards, card] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <EnergyBoost
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSend={handleSend}
      onReveal={handleReveal}
    />
  );
}
