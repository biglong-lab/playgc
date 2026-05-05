import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TeamPoll from "./TeamPoll";
import type { TeamPollConfig, TeamPollState, PollVote } from "./TeamPoll";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TeamPollPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: TeamPollConfig = {
  title: "🗳️ 快速投票",
  question: "請選擇你的選項",
  options: [
    { id: "o1", label: "選項 A" },
    { id: "o2", label: "選項 B" },
    { id: "o3", label: "選項 C" },
  ],
  multiSelect: false,
  showResults: true,
  showVoterNames: true,
};

const DEFAULT_STATE: TeamPollState = { votes: [] };

export default function TeamPollPage({ page, sessionId, gameId, pageId }: TeamPollPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: TeamPollConfig } | TeamPollConfig | null) ?? null;
  const config: TeamPollConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TeamPollConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamPollState>({
    gameId,
    sessionId,
    pageId,
    type: "team_poll",
    defaultState: DEFAULT_STATE,
  });

  const [localSelections, setLocalSelections] = useState<string[]>([]);

  const handleToggleSelection = useCallback(
    (optionId: string) => {
      if (state.votes.some((v: PollVote) => v.userId === myUserId)) return;
      if (!config.multiSelect) {
        setLocalSelections([optionId]);
        return;
      }
      setLocalSelections((prev) => {
        if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
        if (config.maxSelections && prev.length >= config.maxSelections) return prev;
        return [...prev, optionId];
      });
    },
    [config.multiSelect, config.maxSelections, state.votes, myUserId]
  );

  const handleSubmit = useCallback(async () => {
    if (!myUserId || state.votes.some((v: PollVote) => v.userId === myUserId)) return;
    if (localSelections.length === 0) return;
    const newVote: PollVote = {
      userId: myUserId,
      userName: myUserName,
      selections: localSelections,
      votedAt: Date.now(),
    };
    await updateState({ ...state, votes: [...state.votes, newVote] });
  }, [myUserId, myUserName, localSelections, state, updateState]);

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
    <TeamPoll
      config={config}
      state={state}
      myUserId={myUserId}
      localSelections={localSelections}
      onToggleSelection={handleToggleSelection}
      onSubmit={handleSubmit}
    />
  );
}
