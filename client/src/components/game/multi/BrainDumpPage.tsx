import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import BrainDump, { BrainDumpConfig, BrainDumpState, BrainEntry } from "./BrainDump";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: BrainDumpState = { dumps: [], revealed: false };

export default function BrainDumpPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BrainDumpState>({
    gameId,
    sessionId,
    pageId,
    type: "brain_dump",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: BrainDumpConfig =
    "maxItems" in r && typeof r.maxItems === "number"
      ? (r as unknown as BrainDumpConfig)
      : r.config && "maxItems" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as BrainDumpConfig)
        : { title: "💡 腦力傾瀉", prompt: "盡量多寫！每行一個想法", maxItems: 5, maxLength: 40 };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(ideas: string[]) {
    const already = state.dumps.some((d) => d.userId === myUserId);
    if (already) return;
    const dump: BrainEntry = {
      dumpId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      ideas,
    };
    updateState({ ...state, dumps: [...state.dumps, dump] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <BrainDump
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
