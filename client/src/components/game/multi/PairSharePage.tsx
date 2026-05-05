import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import PairShare, { PairShareConfig, PairShareState, PairEntry, PairResult } from "./PairShare";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: PairShareState = { entries: [], pairs: [], unpairedId: null, unpairedName: null, revealed: false };

function buildPairs(entries: PairEntry[]): Pick<PairShareState, "pairs" | "unpairedId" | "unpairedName"> {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const pairs: PairResult[] = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push({
      pairId: `pair-${i}`,
      userAId: shuffled[i].userId,
      userAName: shuffled[i].userName,
      userBId: shuffled[i + 1].userId,
      userBName: shuffled[i + 1].userName,
    });
  }
  const unpaired = shuffled.length % 2 === 1 ? shuffled[shuffled.length - 1] : null;
  return { pairs, unpairedId: unpaired?.userId ?? null, unpairedName: unpaired?.userName ?? null };
}

export default function PairSharePage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PairShareState>({
    gameId,
    sessionId,
    pageId,
    type: "pair_share",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: PairShareConfig =
    "pairingMode" in r
      ? (r as unknown as PairShareConfig)
      : r.config && "pairingMode" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as PairShareConfig)
        : { title: "配對分享", prompt: "加入後系統會隨機幫你配對一位夥伴", pairingMode: "random" };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleJoin() {
    const already = state.entries.some((e) => e.userId === myUserId);
    if (already) return;
    const entry: PairEntry = { entryId: `${myUserId}-${Date.now()}`, userId: myUserId, userName };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    const { pairs, unpairedId, unpairedName } = buildPairs(state.entries);
    updateState({ ...state, pairs, unpairedId, unpairedName, revealed: true });
  }

  return (
    <PairShare
      config={config}
      state={state}
      myUserId={myUserId}
      onJoin={handleJoin}
      onReveal={handleReveal}
    />
  );
}
