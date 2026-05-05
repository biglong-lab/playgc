import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import ReactionWall, {
  type ReactionWallConfig,
  type ReactionWallState,
  type Reaction,
} from "./ReactionWall";

const DEFAULT_CONFIG: ReactionWallConfig = {
  title: "🎭 今天的感覺是？",
  content: "用 emoji 表達你現在的心情！",
  emojis: ["😊", "🤔", "😴", "🔥", "😎", "🥰"],
  showNames: false,
};

const DEFAULT_STATE: ReactionWallState = {
  reactions: [],
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function ReactionWallPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: ReactionWallConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: ReactionWallConfig }).config
      : (rawConfig as ReactionWallConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ReactionWallState>({
    gameId,
    sessionId,
    pageId,
    type: "reaction_wall",
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

  function handleReact(emoji: string) {
    const myExisting = state.reactions.find((r) => r.userId === myUserId);
    if (myExisting?.emoji === emoji) return;

    const filtered = state.reactions.filter((r) => r.userId !== myUserId);
    const newReaction: Reaction = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      emoji,
    };
    updateState({ ...state, reactions: [...filtered, newReaction] });
  }

  return (
    <ReactionWall
      config={config}
      state={state}
      myUserId={myUserId}
      onReact={handleReact}
    />
  );
}
