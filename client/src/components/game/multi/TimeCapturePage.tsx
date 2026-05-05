import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import TimeCapture, {
  type TimeCaptureConfig,
  type TimeCaptureState,
} from "./TimeCapture";

const DEFAULT_CONFIG: TimeCaptureConfig = {
  title: "🕰️ 時空膠囊",
  prompt: "寫下你現在的感受，留給未來的自己",
  maxLength: 200,
  showAuthor: false,
};

const DEFAULT_STATE: TimeCaptureState = {
  messages: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function TimeCapturePage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftText, setDraftText] = useState("");

  const rawConfig = page.config as unknown;
  const config: TimeCaptureConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: TimeCaptureConfig }).config
      : (rawConfig as TimeCaptureConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TimeCaptureState>({
    gameId,
    sessionId,
    pageId,
    type: "time_capture",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-amber-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    if (!draftText.trim()) return;
    const alreadySubmitted = state.messages.some((m) => m.userId === myUserId);
    if (alreadySubmitted) return;

    const newMsg = {
      msgId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
    };
    updateState({ ...state, messages: [...state.messages, newMsg] });
    setDraftText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TimeCapture
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
