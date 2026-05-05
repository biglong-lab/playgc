import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import NeverHaveIEver, {
  type NeverHaveIEverConfig,
  type NeverHaveIEverState,
  type NeverResponse,
} from "./NeverHaveIEver";

const DEFAULT_CONFIG: NeverHaveIEverConfig = {
  title: "🙅 我從來沒有...",
  prompt: "誠實作答，更好玩！",
  statements: ["吃宵夜到天亮", "搭飛機超過 10 小時", "在工作中睡著"],
  showWhoAdmitted: false,
};

const DEFAULT_STATE: NeverHaveIEverState = {
  responses: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function NeverHaveIEverPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: NeverHaveIEverConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: NeverHaveIEverConfig }).config
      : (rawConfig as NeverHaveIEverConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<NeverHaveIEverState>({
    gameId,
    sessionId,
    pageId,
    type: "never_have_i_ever",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleRespond(statementIndex: number, haveDone: boolean) {
    const alreadyAnswered = state.responses.some(
      (r) => r.userId === myUserId && r.statementIndex === statementIndex
    );
    if (alreadyAnswered) return;

    const newResponse: NeverResponse = {
      entryId: `${myUserId}-${statementIndex}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      statementIndex,
      haveDone,
    };
    updateState({ ...state, responses: [...state.responses, newResponse] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <NeverHaveIEver
      config={config}
      state={state}
      myUserId={myUserId}
      onRespond={handleRespond}
      onReveal={handleReveal}
    />
  );
}
