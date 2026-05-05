import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { WishBucket, WishBucketConfig, WishBucketState, WishEntry } from "./WishBucket";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: WishBucketConfig = {
  title: "🌟 許願桶",
  prompt: "把你的願望投入桶中",
  placeholder: "寫下你的願望...",
  maxLength: 150,
  anonymous: false,
};

function extractConfig(raw: Record<string, unknown>): WishBucketConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : DEFAULT_CONFIG.placeholder,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    anonymous: typeof raw.anonymous === "boolean" ? raw.anonymous : DEFAULT_CONFIG.anonymous,
  };
}

const DEFAULT_STATE: WishBucketState = { wishes: [], revealed: false };

export default function WishBucketPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<WishBucketState>({
    gameId,
    sessionId,
    pageId,
    type: "wish_bucket",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(wish: string) {
    const already = state.wishes.some((w: WishEntry) => w.userId === userId);
    if (already) return;
    const entry: WishEntry = {
      wishId: `wb-${Date.now()}-${userId}`,
      userId,
      userName,
      wish,
      anonymous: resolvedConfig.anonymous,
    };
    updateState({ ...state, wishes: [...state.wishes, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <WishBucket
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
