import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import ActionItem, { ActionItemConfig, ActionItemState, ActionEntry } from "./ActionItem";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: ActionItemState = { actions: [], revealed: false };

export default function ActionItemPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ActionItemState>({
    gameId,
    sessionId,
    pageId,
    type: "action_item",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: ActionItemConfig =
    "timeOptions" in r && Array.isArray(r.timeOptions)
      ? (r as unknown as ActionItemConfig)
      : r.config && "timeOptions" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as ActionItemConfig)
        : { title: "行動承諾", prompt: "完成這次活動後，你打算做什麼？", maxLength: 60, timeOptions: ["今天", "本週", "本月"] };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(text: string, timeframe: string) {
    const already = state.actions.some((a) => a.userId === myUserId);
    if (already) return;
    const entry: ActionEntry = {
      actionId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      text,
      timeframe,
    };
    updateState({ ...state, actions: [...state.actions, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ActionItem
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
