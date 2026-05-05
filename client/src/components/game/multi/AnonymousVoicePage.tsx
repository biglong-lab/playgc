import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AnonymousVoice, { AnonymousVoiceConfig, AnonymousVoiceState, AnonEntry } from "./AnonymousVoice";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: AnonymousVoiceConfig = {
  title: "匿名心聲",
  prompt: "有什麼話想說？完全匿名，放心分享",
  maxLength: 120,
};

const DEFAULT_STATE: AnonymousVoiceState = {
  entries: [],
  submitterIds: [],
  revealed: false,
};

export default function AnonymousVoicePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";

  const rawConfig = page?.config;
  const config: AnonymousVoiceConfig =
    rawConfig && typeof rawConfig === "object" && "maxLength" in rawConfig
      ? (rawConfig as AnonymousVoiceConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: AnonymousVoiceConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<AnonymousVoiceState>({
    gameId,
    sessionId,
    pageId,
    type: "anonymous_voice",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  function handleSubmit(text: string) {
    const newEntry: AnonEntry = {
      entryId: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      hearts: [],
    };
    updateState({
      ...state,
      entries: [...state.entries, newEntry],
      submitterIds: [...state.submitterIds, myUserId],
    });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(entryId: string) {
    const updated = state.entries.map((e: AnonEntry) => {
      if (e.entryId !== entryId) return e;
      const already = e.hearts.includes(myUserId);
      return {
        ...e,
        hearts: already ? e.hearts.filter((h: string) => h !== myUserId) : [...e.hearts, myUserId],
      };
    });
    updateState({ ...state, entries: updated });
  }

  return (
    <AnonymousVoice
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
