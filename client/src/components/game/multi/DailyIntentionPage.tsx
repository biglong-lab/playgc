import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import DailyIntention, {
  DailyIntentionConfig,
  DailyIntentionState,
  IntentionCard,
} from "./DailyIntention";

const DEFAULT_CONFIG: DailyIntentionConfig = {
  title: "今日意圖",
  prompt: "今天你最想專注在什麼上面？",
  maxLength: 60,
};

const DEFAULT_STATE: DailyIntentionState = { intentions: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): DailyIntentionConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "prompt" in r && "maxLength" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("prompt" in src && "maxLength" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxLength: (src.maxLength as number) ?? DEFAULT_CONFIG.maxLength,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function DailyIntentionPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<DailyIntentionState>({
    gameId,
    sessionId,
    pageId,
    type: "daily_intention",
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
    const already = state.intentions.find((c) => c.userId === myUserId);
    if (already) return;
    const newCard: IntentionCard = {
      intentionId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
    };
    updateState({ ...state, intentions: [...state.intentions, newCard] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <DailyIntention
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
