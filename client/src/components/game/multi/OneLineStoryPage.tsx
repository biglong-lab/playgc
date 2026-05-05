import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import OneLineStory, { OneLineStoryConfig, OneLineStoryState, StoryLine } from "./OneLineStory";

const DEFAULT_CONFIG: OneLineStoryConfig = {
  title: "一句故事",
  prompt: "用一句話說一個故事，開頭是「那天，」",
  maxLength: 80,
};

const DEFAULT_STATE: OneLineStoryState = { lines: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): OneLineStoryConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "lines" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : r;
    if ("maxLength" in src && "prompt" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function OneLineStoryPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<OneLineStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "one_line_story",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(text: string) {
    const already = state.lines.find((l) => l.userId === myUserId);
    if (already) return;
    const newLine: StoryLine = {
      lineId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
    };
    updateState({ ...state, lines: [...state.lines, newLine] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <OneLineStory
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
