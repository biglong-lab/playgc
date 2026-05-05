import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PhotoCaption, {
  type PhotoCaptionConfig,
  type PhotoCaptionState,
  type Caption,
} from "./PhotoCaption";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PhotoCaptionPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PhotoCaptionConfig = {
  title: "📸 最佳配文大賽",
  photoUrl: "",
  prompt: "看到這張照片，你的第一個念頭是？",
  maxCaptionLength: 80,
  maxCaptionsPerPerson: 2,
  showVotes: true,
};

const DEFAULT_STATE: PhotoCaptionState = { captions: [] };

export default function PhotoCaptionPage({ page, sessionId, gameId, pageId }: PhotoCaptionPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PhotoCaptionConfig } | PhotoCaptionConfig | null) ?? null;
  const config: PhotoCaptionConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PhotoCaptionConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PhotoCaptionState>({
    gameId,
    sessionId,
    pageId,
    type: "photo_caption",
    defaultState: DEFAULT_STATE,
  });

  const [draftCaption, setDraftCaption] = useState("");

  const handleDraftChange = useCallback((value: string) => {
    setDraftCaption(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = draftCaption.trim();
    if (!text) return;
    const mySubmissions = state.captions.filter((c: Caption) => c.submitterId === myUserId);
    if (mySubmissions.length >= config.maxCaptionsPerPerson) return;
    const newCaption: Caption = {
      id: `${myUserId}-${Date.now()}`,
      text,
      submitterId: myUserId,
      submitterName: myUserName,
      votes: [],
      submittedAt: Date.now(),
    };
    await updateState({ ...state, captions: [...state.captions, newCaption] });
    setDraftCaption("");
  }, [state, myUserId, myUserName, draftCaption, config.maxCaptionsPerPerson, updateState]);

  const handleVote = useCallback(async (captionId: string) => {
    const caption = state.captions.find((c: Caption) => c.id === captionId);
    if (!caption || caption.submitterId === myUserId) return;
    const hasVoted = caption.votes.includes(myUserId);
    const updatedVotes = hasVoted
      ? caption.votes.filter((v) => v !== myUserId)
      : [...caption.votes, myUserId];
    const updatedCaptions = state.captions.map((c: Caption) =>
      c.id === captionId ? { ...c, votes: updatedVotes } : c,
    );
    await updateState({ ...state, captions: updatedCaptions });
  }, [state, myUserId, updateState]);

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
    <PhotoCaption
      config={config}
      state={state}
      myUserId={myUserId}
      draftCaption={draftCaption}
      onDraftChange={handleDraftChange}
      onSubmit={handleSubmit}
      onVote={handleVote}
    />
  );
}
