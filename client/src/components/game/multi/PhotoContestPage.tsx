import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PhotoContest, {
  type PhotoContestConfig,
  type PhotoContestState,
  type ContestEntry,
} from "./PhotoContest";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PhotoContestPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PhotoContestConfig = {
  title: "📸 照片競賽",
  prompt: "上傳你的最佳作品，讓大家投票！",
  theme: "",
  maxPhotosPerPerson: 2,
  allowVoteOwn: false,
  showAuthor: true,
  maxCaptionLength: 60,
};

const DEFAULT_STATE: PhotoContestState = {
  entries: [],
  phase: "submit",
};

export default function PhotoContestPage({ page, sessionId, gameId, pageId }: PhotoContestPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PhotoContestConfig } | PhotoContestConfig | null) ?? null;
  const config: PhotoContestConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PhotoContestConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PhotoContestState>({
    gameId,
    sessionId,
    pageId,
    type: "photo_contest",
    defaultState: DEFAULT_STATE,
  });

  const [draftCaption, setDraftCaption] = useState("");
  const [draftImageUrl, setDraftImageUrl] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!draftCaption.trim()) return;
    const newEntry: ContestEntry = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      caption: draftCaption.trim(),
      imageUrl: draftImageUrl.trim() || undefined,
      votes: [],
      submittedAt: Date.now(),
    };
    await updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraftCaption("");
    setDraftImageUrl("");
  }, [state, myUserId, myUserName, draftCaption, draftImageUrl, updateState]);

  const handleVote = useCallback(
    async (entryId: string) => {
      const updatedEntries = state.entries.map((entry: ContestEntry) => {
        if (entry.id !== entryId) return entry;
        if (!config.allowVoteOwn && entry.userId === myUserId) return entry;
        const hasVoted = entry.votes.includes(myUserId);
        const newVotes = hasVoted
          ? entry.votes.filter((v) => v !== myUserId)
          : [...entry.votes, myUserId];
        return { ...entry, votes: newVotes };
      });
      await updateState({ ...state, entries: updatedEntries });
    },
    [state, myUserId, config.allowVoteOwn, updateState],
  );

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
    <PhotoContest
      config={config}
      state={state}
      myUserId={myUserId}
      draftCaption={draftCaption}
      draftImageUrl={draftImageUrl}
      onCaptionChange={setDraftCaption}
      onImageUrlChange={setDraftImageUrl}
      onSubmit={handleSubmit}
      onVote={handleVote}
    />
  );
}
