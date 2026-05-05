import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import CategoryChallenge, {
  type CategoryChallengeConfig,
  type CategoryChallengeState,
  type CategorySubmission,
} from "./CategoryChallenge";

const DEFAULT_CONFIG: CategoryChallengeConfig = {
  title: "🧩 分類挑戰",
  category: "你可以在廚房找到的東西",
  prompt: "列出越多越好！看看大家的答案有多少重疊？",
  maxItemsPerPerson: 8,
  maxItemLength: 20,
  showCommon: true,
};

const DEFAULT_STATE: CategoryChallengeState = {
  submissions: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function CategoryChallengePage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: CategoryChallengeConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: CategoryChallengeConfig }).config
      : (rawConfig as CategoryChallengeConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CategoryChallengeState>({
    gameId,
    sessionId,
    pageId,
    type: "category_challenge",
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

  function handleSubmit(items: string[]) {
    const alreadySubmitted = state.submissions.some((s) => s.userId === myUserId);
    if (alreadySubmitted || items.length === 0) return;

    const newSubmission: CategorySubmission = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      items,
    };
    updateState({ ...state, submissions: [...state.submissions, newSubmission] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CategoryChallenge
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
