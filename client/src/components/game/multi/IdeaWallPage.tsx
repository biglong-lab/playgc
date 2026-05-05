// 💡 IdeaWallPage — pageType="idea_wall" 容器（L3 持久化）
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import IdeaWall, {
  type IdeaWallConfig,
  type IdeaWallState,
  type IdeaCard,
} from "./IdeaWall";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface IdeaWallPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: IdeaWallConfig = {
  title: "💡 創意投票牆",
  prompt: "分享你的點子，大家投票選最好的！",
  placeholder: "寫下你的想法…",
  maxLength: 80,
  maxIdeasPerPerson: 3,
  showAuthor: true,
  allowVoteOwn: false,
};

const DEFAULT_STATE: IdeaWallState = { ideas: [] };

export default function IdeaWallPage({ page, sessionId, gameId, pageId }: IdeaWallPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: IdeaWallConfig } | IdeaWallConfig | null) ?? null;
  const config: IdeaWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as IdeaWallConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<IdeaWallState>({
    gameId,
    sessionId,
    pageId,
    type: "idea_wall",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");

  const handleAdd = useCallback(async () => {
    if (!draftText.trim()) return;
    const newIdea: IdeaCard = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
      emoji: draftEmoji || undefined,
      votes: [],
      addedAt: Date.now(),
    };
    await updateState({ ...state, ideas: [...state.ideas, newIdea] });
    setDraftText("");
    setDraftEmoji("");
  }, [state, myUserId, myUserName, draftText, draftEmoji, updateState]);

  const handleVote = useCallback(
    async (ideaId: string) => {
      const updatedIdeas = state.ideas.map((idea: IdeaCard) => {
        if (idea.id !== ideaId) return idea;
        if (!config.allowVoteOwn && idea.userId === myUserId) return idea;
        const hasVoted = idea.votes.includes(myUserId);
        const newVotes = hasVoted
          ? idea.votes.filter((v) => v !== myUserId)
          : [...idea.votes, myUserId];
        return { ...idea, votes: newVotes };
      });
      await updateState({ ...state, ideas: updatedIdeas });
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
    <IdeaWall
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      draftEmoji={draftEmoji}
      onTextChange={setDraftText}
      onEmojiChange={setDraftEmoji}
      onAdd={handleAdd}
      onVote={handleVote}
    />
  );
}
