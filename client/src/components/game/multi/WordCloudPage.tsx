import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import WordCloud, {
  WordCloudConfig,
  WordCloudState,
  WordEntry,
} from "./WordCloud";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: WordCloudConfig = {
  title: "文字雲",
  prompt: "用一到三個詞描述現在的心情",
  maxWords: 3,
  maxWordLength: 10,
  showAuthor: false,
};

const DEFAULT_STATE: WordCloudState = {
  entries: [],
  revealed: false,
};

export default function WordCloudPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: WordCloudConfig =
    raw && typeof raw === "object" && "maxWords" in raw
      ? (raw as WordCloudConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: WordCloudConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<WordCloudState>({
      gameId,
      sessionId,
      pageId,
      type: "word_cloud",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(words: string[]) {
    if (state.entries.find((e: WordEntry) => e.userId === myUserId)) return;
    const newEntry: WordEntry = {
      wordId: `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      words,
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <WordCloud
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
