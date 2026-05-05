// 🎲 RandomTeamPage — pageType="random_team" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RandomTeam, {
  type RandomTeamConfig,
  type RandomTeamState,
  type WaitingMember,
  type MemberAssignment,
} from "./RandomTeam";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface RandomTeamPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: RandomTeamConfig = {
  title: "🎲 隨機分組",
  subtitle: "加入等待，一鍵隨機分配隊伍！",
  teams: [
    { id: "t1", name: "A 組", emoji: "🔵", color: "blue" },
    { id: "t2", name: "B 組", emoji: "🔴", color: "red" },
    { id: "t3", name: "C 組", emoji: "🟢", color: "green" },
    { id: "t4", name: "D 組", emoji: "🟡", color: "yellow" },
  ],
  startText: "開始分組！",
};

const DEFAULT_STATE: RandomTeamState = {
  waiting: [],
  assignments: [],
  phase: "waiting",
  hostUserId: null,
};

export default function RandomTeamPage({ page, sessionId, gameId, pageId, onComplete }: RandomTeamPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: RandomTeamConfig } | RandomTeamConfig | null) ?? null;
  const config: RandomTeamConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as RandomTeamConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<RandomTeamState>({
    gameId, sessionId, pageId, type: "random_team", defaultState: DEFAULT_STATE,
  });

  const handleJoinWaiting = useCallback(async () => {
    const already = state.waiting.some((w: WaitingMember) => w.userId === myUserId);
    if (already || state.phase !== "waiting") return;
    const newMember: WaitingMember = { userId: myUserId, userName: myUserName };
    await updateState({ ...state, waiting: [...state.waiting, newMember] });
  }, [state, myUserId, myUserName, updateState]);

  const handleShuffle = useCallback(async () => {
    if (state.phase !== "waiting" || state.waiting.length < 2) return;
    const teams = config.teams;
    if (teams.length === 0) return;

    // 隨機洗牌等待名單
    const shuffled = [...state.waiting].sort(() => Math.random() - 0.5);
    const assignments: MemberAssignment[] = shuffled.map((w, idx) => ({
      userId: w.userId,
      userName: w.userName,
      teamId: teams[idx % teams.length].id,
    }));

    await updateState({
      ...state,
      phase: "assigned",
      assignments,
      hostUserId: myUserId,
    });
    if (onComplete) onComplete();
  }, [state, config.teams, myUserId, updateState, onComplete]);

  const handleReset = useCallback(async () => {
    await updateState({ ...state, phase: "waiting", assignments: [], waiting: [] });
  }, [state, updateState]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <RandomTeam
      config={config}
      state={state}
      myUserId={myUserId}
      onJoinWaiting={handleJoinWaiting}
      onShuffle={handleShuffle}
      onReset={handleReset}
    />
  );
}
