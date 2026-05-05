import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { PixelMood } from "./PixelMood";
import type { PixelMoodConfig, PixelMoodState, MoodEntry } from "./PixelMood";

const DEFAULT_CONFIG: PixelMoodConfig = {
  title: "心情馬賽克",
  prompt: "選一個最能代表你現在心情的顏色",
  moods: [
    { id: "happy", emoji: "😊", label: "開心", color: "#FFD700" },
    { id: "excited", emoji: "🚀", label: "興奮", color: "#FF6B35" },
    { id: "calm", emoji: "😌", label: "平靜", color: "#4ECDC4" },
    { id: "tired", emoji: "😴", label: "疲倦", color: "#95A5A6" },
    { id: "curious", emoji: "🤔", label: "好奇", color: "#9B59B6" },
    { id: "nervous", emoji: "😬", label: "緊張", color: "#E74C3C" },
  ],
};

function extractConfig(raw: Record<string, unknown>): PixelMoodConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    moods: Array.isArray(raw.moods) ? (raw.moods as PixelMoodConfig["moods"]) : DEFAULT_CONFIG.moods,
  };
}

const DEFAULT_STATE: PixelMoodState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PixelMoodPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<PixelMoodState>({
    gameId,
    sessionId,
    pageId,
    type: "pixel_mood",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(moodId: string) {
    const entry: MoodEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      moodId,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <PixelMood
      config={config}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      isLoaded={isLoaded}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}

export default PixelMoodPage;
