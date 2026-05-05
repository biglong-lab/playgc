import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LetterToSelf from "./LetterToSelf";
import type { LetterToSelfConfig, LetterToSelfState, SelfLetter } from "./LetterToSelf";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface LetterToSelfPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: LetterToSelfConfig = {
  title: "✉️ 給未來自己的信",
  prompt: "課程結束了，你想對三個月後的自己說什麼？",
  maxLength: 300,
  showAuthor: false,
};

const DEFAULT_STATE: LetterToSelfState = {
  letters: [],
  revealed: false,
};

export default function LetterToSelfPage({ page, sessionId, gameId, pageId }: LetterToSelfPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: LetterToSelfConfig } | LetterToSelfConfig | null) ?? null;
  const config: LetterToSelfConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as LetterToSelfConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<LetterToSelfState>({
    gameId,
    sessionId,
    pageId,
    type: "letter_to_self",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!draftText.trim()) return;
    const already = state.letters.some((l: SelfLetter) => l.userId === myUserId);
    if (already) return;
    const newLetter: SelfLetter = {
      letterId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      content: draftText.trim(),
    };
    await updateState({ ...state, letters: [...state.letters, newLetter] });
    setDraftText("");
  }, [draftText, state, myUserId, myUserName, updateState]);

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <LetterToSelf
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
