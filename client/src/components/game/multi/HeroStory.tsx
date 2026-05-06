import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StoryEntry {
  entryId: string;
  userId: string;
  userName: string;
  title: string;
  challenge: string;
  lesson: string;
}

interface HeroStoryState extends Record<string, unknown> {
  entries: StoryEntry[];
  revealed: boolean;
}

interface HeroStoryConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): HeroStoryConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "英雄故事",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "分享一個你克服困難、讓自己引以為傲的小故事",
  };
}

const CARD_COLORS = [
  "from-rose-400 to-orange-300",
  "from-violet-400 to-pink-300",
  "from-blue-400 to-cyan-300",
  "from-green-400 to-teal-300",
  "from-amber-400 to-yellow-300",
  "from-indigo-400 to-purple-300",
];

const DEFAULT_STATE: HeroStoryState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HeroStory({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<HeroStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "hero_story",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [title, setTitle] = useState("");
  const [challenge, setChallenge] = useState("");
  const [lesson, setLesson] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="hs-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit =
    title.trim().length >= 2 &&
    challenge.trim().length >= 5 &&
    lesson.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: StoryEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      title: title.trim(),
      challenge: challenge.trim(),
      lesson: lesson.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setTitle("");
    setChallenge("");
    setLesson("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const total = state.entries.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold" data-testid="hs-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="hs-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="hs-count">
        已提交：{total} 個故事
      </p>

      {!myEntry ? (
        <div data-testid="hs-form" className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              故事標題（≥2 字）
            </label>
            <input
              data-testid="hs-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="用一句話為你的故事命名"
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              當時的挑戰（≥5 字）
            </label>
            <textarea
              data-testid="hs-challenge-input"
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="描述你面對的困難或障礙"
              rows={2}
              className="w-full p-2 border rounded text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              從中學到的（≥5 字）
            </label>
            <textarea
              data-testid="hs-lesson-input"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="這個經驗帶給你什麼洞見？"
              rows={2}
              className="w-full p-2 border rounded text-sm resize-none"
            />
          </div>
          <button
            data-testid="hs-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-amber-500 text-white rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的故事
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-amber-50 rounded border border-amber-200 text-sm space-y-1"
          data-testid="hs-my-entry"
        >
          <p className="text-xs text-amber-700 font-medium">你的故事已送出</p>
          <p className="font-bold text-amber-900">⭐ {myEntry.title}</p>
          <p className="text-xs text-amber-700">{myEntry.challenge}</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="hs-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-amber-500 text-white rounded text-sm"
        >
          揭示全隊故事
        </button>
      )}

      {state.revealed && (
        <div data-testid="hs-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🌟 英雄故事牆</p>
          {total === 0 ? (
            <p data-testid="hs-empty" className="text-gray-400 text-sm">
              尚無故事
            </p>
          ) : (
            <div data-testid="hs-story-list" className="space-y-3">
              {state.entries.map((e, idx) => (
                <div
                  key={e.entryId}
                  data-testid={`hs-card-${e.entryId}`}
                  className={`p-3 rounded-lg bg-gradient-to-br ${CARD_COLORS[idx % CARD_COLORS.length]} text-white space-y-1.5`}
                >
                  <p className="font-bold text-sm">⭐ {e.title}</p>
                  <div className="text-xs opacity-90 space-y-0.5">
                    <p>
                      <span className="font-semibold">挑戰：</span>
                      {e.challenge}
                    </p>
                    <p>
                      <span className="font-semibold">洞見：</span>
                      {e.lesson}
                    </p>
                  </div>
                  <p className="text-xs opacity-70 text-right">— {e.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HeroStory;
