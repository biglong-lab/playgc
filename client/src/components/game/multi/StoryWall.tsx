import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface StoryEntry extends Record<string, unknown> {
  storyId: string;
  userId: string;
  userName: string;
  title: string;
  text: string;
}

export interface StoryWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxTitleLength: number;
  maxLength: number;
}

export interface StoryWallState extends Record<string, unknown> {
  stories: StoryEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): StoryWallConfig {
  return {
    title: (raw.title as string) || "📖 故事牆",
    prompt: (raw.prompt as string) || "分享一段你的親身經歷或故事",
    maxTitleLength: (raw.maxTitleLength as number) ?? 40,
    maxLength: (raw.maxLength as number) ?? 200,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const CARD_COLORS = [
  "bg-amber-50 border-amber-200",
  "bg-blue-50 border-blue-200",
  "bg-green-50 border-green-200",
  "bg-purple-50 border-purple-200",
  "bg-rose-50 border-rose-200",
  "bg-teal-50 border-teal-200",
];

export function StoryWall({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: StoryWallState = { stories: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<StoryWallState>({
    gameId,
    sessionId,
    pageId,
    type: "story_wall",
    defaultState,
  });

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="stw-loading" />
      </div>
    );
  }

  const myStory = state.stories.find((s) => s.userId === userId);

  function handleSubmit() {
    if (!title.trim() || !text.trim() || myStory) return;
    const storyId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      stories: [...state.stories, { storyId, userId, userName, title: title.trim(), text: text.trim() }],
    });
    setTitle("");
    setText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="stw-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500" data-testid="stw-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-400" data-testid="stw-count">已分享：{state.stories.length} 個故事</p>

      {!myStory && !state.revealed && (
        <div className="space-y-2">
          <input
            className="w-full border rounded px-3 py-2 text-sm focus:border-amber-400"
            placeholder="故事標題..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={cfg.maxTitleLength}
            data-testid="stw-title-input"
          />
          <textarea
            className="w-full border rounded px-3 py-2 h-24 text-sm focus:border-amber-400"
            placeholder="寫下你的故事..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={cfg.maxLength}
            data-testid="stw-text-input"
          />
          <button
            className="w-full py-2 bg-amber-600 text-white rounded disabled:opacity-50 text-sm"
            disabled={!title.trim() || !text.trim()}
            onClick={handleSubmit}
            data-testid="stw-submit-btn"
          >
            分享故事
          </button>
        </div>
      )}

      {myStory && !state.revealed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded" data-testid="stw-my-story">
          <p className="font-semibold text-amber-800 text-sm">{myStory.title}</p>
          <p className="text-gray-600 text-sm mt-1 line-clamp-3">{myStory.text}</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-amber-600 text-white rounded text-sm"
          onClick={handleReveal}
          data-testid="stw-reveal-btn"
        >
          揭曉所有故事
        </button>
      )}

      {state.revealed && (
        <div data-testid="stw-result">
          <h3 className="font-semibold mb-3 text-sm">📖 所有故事</h3>
          {state.stories.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-sm" data-testid="stw-empty">沒有人分享故事</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {state.stories.map((story, i) => (
                <div
                  key={story.storyId}
                  className={`border rounded-lg p-3 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                  data-testid={`stw-story-${story.storyId}`}
                >
                  <p className="font-semibold text-sm text-gray-800">{story.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">👤 {story.userName}</p>
                  <p className="text-sm text-gray-700 mt-2">{story.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StoryWall;
