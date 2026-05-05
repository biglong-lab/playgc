import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import ActionPledge, {
  type ActionPledgeConfig,
  type ActionPledgeState,
} from "./ActionPledge";

const DEFAULT_CONFIG: ActionPledgeConfig = {
  title: "行動宣誓牆",
  prompt: "這次課程結束後，你最想落實的一件事是什麼？",
  actionLabel: "我承諾會…",
  timelineOptions: ["1週內", "2週內", "1個月內", "3個月內"],
  showAuthor: true,
};

const DEFAULT_STATE: ActionPledgeState = {
  pledges: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function ActionPledgePage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftAction, setDraftAction] = useState("");
  const [draftTimeline, setDraftTimeline] = useState("");

  const rawConfig = page.config as unknown;
  const config: ActionPledgeConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: ActionPledgeConfig }).config
      : (rawConfig as ActionPledgeConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ActionPledgeState>({
    gameId,
    sessionId,
    pageId,
    type: "action_pledge",
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

  function handleSubmit() {
    if (!draftAction.trim() || !draftTimeline) return;
    const alreadySubmitted = state.pledges.some((p) => p.userId === myUserId);
    if (alreadySubmitted) return;

    const newPledge = {
      pledgeId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      action: draftAction.trim(),
      timeline: draftTimeline,
    };
    updateState({ ...state, pledges: [...state.pledges, newPledge] });
    setDraftAction("");
    setDraftTimeline("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ActionPledge
      config={config}
      state={state}
      myUserId={myUserId}
      draftAction={draftAction}
      draftTimeline={draftTimeline}
      onDraftActionChange={setDraftAction}
      onDraftTimelineChange={setDraftTimeline}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
