import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import PledgeWall from "./PledgeWall";
import type { PledgeWallConfig, PledgeWallState, PledgeCard } from "./PledgeWall";

const DEFAULT_CONFIG: PledgeWallConfig = {
  title: "🤝 承諾牆",
  prompt: "許下你的承諾，讓大家一起見證",
  placeholder: "我承諾…",
  maxLength: 80,
  showSupport: true,
  emojiOptions: ["🌱", "♻️", "🤝", "💪", "🌍", "❤️", "✨", "🎯", "📚", "🏃"],
};

const DEFAULT_STATE: PledgeWallState = { pledges: [] };

interface Props {
  page: Page;
  pageId: string;
  sessionId: string;
  gameId: string;
  onComplete?: () => void;
}

export default function PledgeWallPage({ page, pageId, sessionId, gameId, onComplete }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PledgeWallConfig } | PledgeWallConfig | null) ?? null;
  const config: PledgeWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PledgeWallConfig | null)) ??
    DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PledgeWallState>({
    gameId,
    sessionId,
    pageId,
    type: "pledge_wall",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!draftText.trim() || !draftEmoji) return;
    const already = state.pledges.find((p) => p.userId === myUserId);
    if (already) return;

    const newPledge: PledgeCard = {
      userId: myUserId,
      userName: myUserName,
      pledge: draftText.trim(),
      emoji: draftEmoji,
      supportCount: 0,
      supporters: [],
      addedAt: Date.now(),
    };
    await updateState({ pledges: [...state.pledges, newPledge] });
    setDraftText("");
    setDraftEmoji("");
    if (onComplete) onComplete();
  }, [draftText, draftEmoji, myUserId, myUserName, state.pledges, updateState, onComplete]);

  const handleSupport = useCallback(
    async (targetUserId: string) => {
      const updated = state.pledges.map((p) => {
        if (p.userId !== targetUserId || p.userId === myUserId) return p;
        const hasSupported = p.supporters.includes(myUserId);
        const newSupporters = hasSupported
          ? p.supporters.filter((s) => s !== myUserId)
          : [...p.supporters, myUserId];
        return { ...p, supporters: newSupporters, supportCount: newSupporters.length };
      });
      await updateState({ pledges: updated });
    },
    [myUserId, state.pledges, updateState],
  );

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <PledgeWall
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      draftEmoji={draftEmoji}
      onTextChange={setDraftText}
      onEmojiChange={setDraftEmoji}
      onSubmit={handleSubmit}
      onSupport={handleSupport}
    />
  );
}
