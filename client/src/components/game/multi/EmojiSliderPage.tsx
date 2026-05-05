import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import EmojiSlider, {
  EmojiSliderConfig,
  EmojiSliderState,
  SliderResponse,
} from "./EmojiSlider";

const DEFAULT_CONFIG: EmojiSliderConfig = {
  title: "情緒滑桿",
  question: "你現在的感受？",
  leftEmoji: "😞",
  rightEmoji: "😄",
  leftLabel: "很低落",
  rightLabel: "很開心",
};

const DEFAULT_STATE: EmojiSliderState = {
  responses: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): EmojiSliderConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "leftEmoji" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("leftEmoji" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        question: (src.question as string) ?? DEFAULT_CONFIG.question,
        leftEmoji: (src.leftEmoji as string) ?? DEFAULT_CONFIG.leftEmoji,
        rightEmoji: (src.rightEmoji as string) ?? DEFAULT_CONFIG.rightEmoji,
        leftLabel: (src.leftLabel as string) ?? DEFAULT_CONFIG.leftLabel,
        rightLabel: (src.rightLabel as string) ?? DEFAULT_CONFIG.rightLabel,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function EmojiSliderPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiSliderState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_slider",
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

  function handleSubmit(value: number) {
    const already = state.responses.find((r) => r.userId === myUserId);
    if (already) return;
    const newResponse: SliderResponse = {
      responseId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      value,
    };
    updateState({ ...state, responses: [...state.responses, newResponse] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <EmojiSlider
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
