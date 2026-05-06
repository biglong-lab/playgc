import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CampfireStoryEntry {
  entryId: string;
  userId: string;
  userName: string;
  storyType: string;
  story: string;
}

interface CampfireStoryState extends Record<string, unknown> {
  entries: CampfireStoryEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: CampfireStoryState = { entries: [], revealed: false };

const STORY_TYPES = [
  { id: "adventure", label: "冒險", icon: "🌄", desc: "勇敢無畏的探索旅程" },
  { id: "mystery", label: "謎題", icon: "🔍", desc: "撲朔迷離的神秘事件" },
  { id: "lesson", label: "啟示", icon: "💡", desc: "人生中的重要領悟" },
  { id: "memory", label: "回憶", icon: "🎞️", desc: "永遠珍藏的美好時光" },
  { id: "dream", label: "夢想", icon: "🌟", desc: "心中最美的想像世界" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function CampfireStory({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CampfireStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "campfire_story",
    defaultState: DEFAULT_STATE,
  });

  const [selectedType, setSelectedType] = useState("adventure");
  const [story, setStory] = useState("");

  if (!isLoaded) return <div data-testid="cfs-loading">載入中...</div>;

  const title = config?.title ?? "營火故事";
  const prompt = config?.prompt ?? "圍著營火，輪到你說故事了，分享一個只有你才能說的故事";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = story.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: CampfireStoryEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      storyType: selectedType,
      story: story.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setStory("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="cfs-title" className="text-2xl font-bold text-orange-700">
        {title}
      </h2>
      <p data-testid="cfs-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="cfs-count" className="text-sm text-gray-500">
        已分享 {state.entries.length} 個故事
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="cfs-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {STORY_TYPES.map((st) => (
              <button
                key={st.id}
                data-testid={`cfs-type-${st.id}`}
                onClick={() => setSelectedType(st.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedType === st.id
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 hover:border-orange-300"
                }`}
              >
                <div className="text-xl">{st.icon}</div>
                <div className="text-xs font-medium">{st.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{st.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cfs-story-input"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="說出你的故事..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
          <button
            data-testid="cfs-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold disabled:opacity-40"
          >
            說出故事 🔥
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="cfs-my-entry" className="p-4 bg-orange-50 rounded-xl border border-orange-200 space-y-1">
          <p className="text-sm text-orange-600 font-medium">
            {STORY_TYPES.find((s) => s.id === myEntry.storyType)?.icon}{" "}
            {STORY_TYPES.find((s) => s.id === myEntry.storyType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.story}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cfs-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-amber-600 text-white font-semibold"
        >
          揭曉所有故事 🔥
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="cfs-empty" className="text-center text-gray-400 py-8">
          營火旁尚無故事
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="cfs-result" className="space-y-3">
          <h3 className="font-semibold text-orange-700">所有故事已揭曉</h3>
          {state.entries.map((entry) => {
            const st = STORY_TYPES.find((s) => s.id === entry.storyType);
            return (
              <div
                key={entry.entryId}
                data-testid={`cfs-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-orange-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{st?.icon}</span>
                  <span className="font-medium text-orange-700">{st?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.story}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
