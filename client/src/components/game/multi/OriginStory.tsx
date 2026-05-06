import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StoryEntry {
  entryId: string;
  userId: string;
  userName: string;
  turning: string;
  lesson: string;
  emoji: string;
}

interface OriginStoryState extends Record<string, unknown> {
  entries: StoryEntry[];
  revealed: boolean;
}

interface OriginStoryConfig {
  title: string;
  prompt: string;
  turningPlaceholder: string;
  lessonPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): OriginStoryConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "起源故事",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "分享一個讓你成為現在這個人的關鍵轉折點：",
    turningPlaceholder:
      typeof raw.turningPlaceholder === "string"
        ? raw.turningPlaceholder
        : "那個改變你的時刻或事件是什麼？（≥5字）",
    lessonPlaceholder:
      typeof raw.lessonPlaceholder === "string"
        ? raw.lessonPlaceholder
        : "你從中學到了什麼？（選填）",
  };
}

const STORY_EMOJIS = ["🌟", "🔥", "💡", "🌊", "🌱", "⚡", "🎯", "🦋", "🌙", "🏔️"];

const DEFAULT_STATE: OriginStoryState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function OriginStory({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<OriginStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "origin_story",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [turning, setTurning] = useState("");
  const [lesson, setLesson] = useState("");
  const [emoji, setEmoji] = useState(STORY_EMOJIS[0] ?? "🌟");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="os-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = turning.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: StoryEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      turning: turning.trim(),
      lesson: lesson.trim(),
      emoji,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-rose-500" />
        <h2 className="text-xl font-bold" data-testid="os-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="os-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="os-count">
        已分享：{state.entries.length} 個故事
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="os-form">
          <div>
            <p className="text-xs text-gray-500 mb-1">選一個代表情緒的符號</p>
            <div className="flex gap-2 flex-wrap" data-testid="os-emoji-picker">
              {STORY_EMOJIS.map((e) => (
                <button
                  key={e}
                  data-testid={`os-emoji-${e}`}
                  onClick={() => setEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-full transition-all ${
                    emoji === e
                      ? "bg-rose-100 ring-2 ring-rose-400 scale-110"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="os-turning-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder={cfg.turningPlaceholder}
            maxLength={120}
            value={turning}
            onChange={(e) => setTurning(e.target.value)}
          />

          <textarea
            data-testid="os-lesson-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.lessonPlaceholder}
            maxLength={80}
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          />

          <button
            data-testid="os-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-rose-500 text-white rounded disabled:opacity-40 text-sm"
          >
            分享故事
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-rose-50 rounded border border-rose-200 text-sm space-y-1"
          data-testid="os-my-entry"
        >
          <p className="text-2xl">{myEntry.emoji}</p>
          <p className="font-medium text-gray-800">{myEntry.turning}</p>
          {myEntry.lesson && (
            <p className="text-xs text-gray-500 italic">💡 「{myEntry.lesson}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="os-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊故事
        </button>
      )}

      {state.revealed && (
        <div data-testid="os-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📖 起源故事牆</p>
          {state.entries.length === 0 ? (
            <p data-testid="os-empty" className="text-gray-400 text-sm">
              尚無故事
            </p>
          ) : (
            <div className="space-y-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`os-card-${entry.entryId}`}
                  className="p-3 bg-white border-l-4 border-rose-400 rounded-r shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{entry.emoji}</span>
                    <span className="text-xs font-semibold text-gray-600">{entry.userName}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1">{entry.turning}</p>
                  {entry.lesson && (
                    <p className="text-xs text-gray-400 italic mt-0.5">💡 「{entry.lesson}」</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OriginStory;
