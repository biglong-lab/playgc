import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface DinnerEntry {
  entryId: string;
  userId: string;
  userName: string;
  topic: string;
  story: string;
}

interface DinnerTableState extends Record<string, unknown> {
  entries: DinnerEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: DinnerTableState = { entries: [], revealed: false };

const TOPICS = [
  { id: "travel", label: "旅行故事", icon: "✈️", desc: "最難忘的旅行" },
  { id: "childhood", label: "兒時記憶", icon: "🎠", desc: "小時候的趣事" },
  { id: "dream", label: "未來夢想", icon: "🌠", desc: "你最想實現的事" },
  { id: "food", label: "最愛食物", icon: "🍜", desc: "人生必吃的一道菜" },
  { id: "funny", label: "爆笑瞬間", icon: "😂", desc: "讓大家笑翻的故事" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function DinnerTable({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<DinnerTableState>({
    gameId,
    sessionId,
    pageId,
    type: "dinner_table",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState("travel");
  const [story, setStory] = useState("");

  if (!isLoaded) return <div data-testid="dnt-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "餐桌話題";
  const prompt = config?.prompt ?? "選一個話題，分享你的故事或想法，讓對話更有溫度";
  const entries = (state.entries ?? []) as DinnerEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = story.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: DinnerEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      topic: selectedTopic,
      story: story.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setStory("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="dnt-title" className="text-xl font-bold text-center text-orange-700">{title}</h2>
      <p data-testid="dnt-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="dnt-count" className="text-center text-xs text-gray-400">已分享：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="dnt-form" className="space-y-3">
          <div data-testid="dnt-topic-grid" className="grid grid-cols-1 gap-2">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                data-testid={`dnt-topic-${t.id}`}
                onClick={() => setSelectedTopic(t.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedTopic === t.id ? "bg-orange-100 border-orange-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{t.icon}</span>
                <div>
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="dnt-story-input"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="說說你的故事（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            data-testid="dnt-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-orange-500 text-white font-medium disabled:opacity-40"
          >
            上菜分享
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="dnt-my-entry" className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-medium text-orange-700">我的故事已上桌</p>
          <p className="text-xs text-gray-500 mt-1">{TOPICS.find((t) => t.id === myEntry.topic)?.label} — {myEntry.story}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="dnt-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          開放所有故事
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="dnt-empty" className="text-center text-gray-400 py-8">還沒有人上菜</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="dnt-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`dnt-card-${e.entryId}`} className="bg-white border border-orange-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{TOPICS.find((t) => t.id === e.topic)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{TOPICS.find((t) => t.id === e.topic)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.story}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
