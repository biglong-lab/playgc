import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import SilentDebate, {
  SilentDebateConfig,
  SilentDebateState,
  DebateArgument,
} from "./SilentDebate";

const DEFAULT_CONFIG: SilentDebateConfig = {
  title: "靜默辯論",
  topic: "討論主題",
  proLabel: "正方",
  conLabel: "反方",
  maxLength: 100,
};

const DEFAULT_STATE: SilentDebateState = {
  arguments: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): SilentDebateConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "topic" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("topic" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        topic: (src.topic as string) ?? DEFAULT_CONFIG.topic,
        proLabel: (src.proLabel as string) ?? DEFAULT_CONFIG.proLabel,
        conLabel: (src.conLabel as string) ?? DEFAULT_CONFIG.conLabel,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function SilentDebatePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<SilentDebateState>({
    gameId,
    sessionId,
    pageId,
    type: "silent_debate",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(side: "pro" | "con", text: string) {
    const already = state.arguments.find((a) => a.userId === myUserId);
    if (already) return;
    const newArg: DebateArgument = {
      argId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      side,
      text,
      hearts: [],
    };
    updateState({ ...state, arguments: [...state.arguments, newArg] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(argId: string) {
    const updated = state.arguments.map((a: DebateArgument) => {
      if (a.argId !== argId) return a;
      const already = a.hearts.includes(myUserId);
      return {
        ...a,
        hearts: already
          ? a.hearts.filter((h: string) => h !== myUserId)
          : [...a.hearts, myUserId],
      };
    });
    updateState({ ...state, arguments: updated });
  }

  return (
    <SilentDebate
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
