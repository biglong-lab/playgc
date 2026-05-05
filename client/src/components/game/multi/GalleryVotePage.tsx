import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import {
  GalleryVote,
  GalleryVoteConfig,
  GalleryVoteState,
  GallerySub,
  GalleryVoteEntry,
} from "./GalleryVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: GalleryVoteConfig = {
  title: "🖼 作品票選",
  prompt: "提交你的作品，然後為最喜歡的投票",
  galleryLabel: "作品內容",
  placeholder: "輸入你的作品名稱或描述...",
  maxLength: 100,
};

function extractConfig(raw: Record<string, unknown>): GalleryVoteConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    galleryLabel:
      typeof raw.galleryLabel === "string" ? raw.galleryLabel : DEFAULT_CONFIG.galleryLabel,
    placeholder:
      typeof raw.placeholder === "string" ? raw.placeholder : DEFAULT_CONFIG.placeholder,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
  };
}

const DEFAULT_STATE: GalleryVoteState = { submissions: [], votes: [], revealed: false };

export default function GalleryVotePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<GalleryVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "gallery_vote",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(content: string) {
    const already = state.submissions.some((s: GallerySub) => s.userId === userId);
    if (already) return;
    const sub: GallerySub = {
      subId: `gv-sub-${Date.now()}-${userId}`,
      userId,
      userName,
      content,
    };
    updateState({ ...state, submissions: [...state.submissions, sub] });
  }

  function handleVote(targetId: string) {
    const already = state.votes.some((v: GalleryVoteEntry) => v.userId === userId);
    if (already) return;
    const vote: GalleryVoteEntry = {
      voteId: `gv-vote-${Date.now()}-${userId}`,
      userId,
      userName,
      targetId,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <GalleryVote
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
