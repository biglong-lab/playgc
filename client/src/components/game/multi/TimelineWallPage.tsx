import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import TimelineWall from "./TimelineWall";
import type { TimelineWallConfig, TimelineWallState, TimelineEntry } from "./TimelineWall";

const DEFAULT_CONFIG: TimelineWallConfig = {
  title: "📅 集體時間軸",
  prompt: "寫下你的回憶，一起拼出共同的故事",
  placeholder: "寫下這一年的回憶…",
  maxEntriesPerPerson: 2,
  maxTextLength: 60,
  showAuthor: true,
};

const DEFAULT_STATE: TimelineWallState = { entries: [] };

interface Props {
  page: Page;
  pageId: string;
  sessionId: string;
  gameId: string;
  onComplete?: () => void;
}

export default function TimelineWallPage({ page, pageId, sessionId, gameId, onComplete }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: TimelineWallConfig } | TimelineWallConfig | null) ?? null;
  const config: TimelineWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TimelineWallConfig | null)) ??
    DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TimelineWallState>({
    gameId,
    sessionId,
    pageId,
    type: "timeline_wall",
    defaultState: DEFAULT_STATE,
  });

  const [draftYear, setDraftYear] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");

  const handleAdd = useCallback(async () => {
    const year = draftYear.trim();
    const text = draftText.trim();
    if (!year || !text) return;

    const myCount = state.entries.filter((e) => e.userId === myUserId).length;
    if (myCount >= config.maxEntriesPerPerson) return;

    const newEntry: TimelineEntry = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      yearLabel: year,
      text: text.slice(0, config.maxTextLength),
      emoji: draftEmoji || undefined,
      addedAt: Date.now(),
    };

    const filtered = state.entries.filter((e) => !(e.userId === myUserId && e.yearLabel === year && e.text === text));
    await updateState({ entries: [...filtered, newEntry] });
    setDraftYear("");
    setDraftText("");
    setDraftEmoji("");

    const newCount = myCount + 1;
    if (newCount >= config.maxEntriesPerPerson && onComplete) onComplete();
  }, [draftYear, draftText, draftEmoji, state.entries, myUserId, myUserName, config, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <TimelineWall
      config={config}
      state={state}
      myUserId={myUserId}
      draftYear={draftYear}
      draftText={draftText}
      draftEmoji={draftEmoji}
      onYearChange={setDraftYear}
      onTextChange={setDraftText}
      onEmojiChange={setDraftEmoji}
      onAdd={handleAdd}
    />
  );
}
