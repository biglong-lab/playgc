import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface MuseumEntry {
  entryId: string;
  userId: string;
  userName: string;
  category: string;
  description: string;
}

interface MuseumCardState extends Record<string, unknown> {
  entries: MuseumEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: MuseumCardState = { entries: [], revealed: false };

const CATEGORIES = [
  { id: "personal", label: "個人物品", icon: "🎒", desc: "最能代表你的東西" },
  { id: "childhood", label: "童年回憶", icon: "🧸", desc: "珍貴的記憶物件" },
  { id: "work", label: "工作成果", icon: "🏆", desc: "引以為傲的作品" },
  { id: "heritage", label: "家傳之寶", icon: "👑", desc: "家人留下的珍品" },
  { id: "creation", label: "未來創作", icon: "✨", desc: "你想創造的物件" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function MuseumCard({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<MuseumCardState>({
    gameId,
    sessionId,
    pageId,
    type: "museum_card",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("personal");
  const [description, setDescription] = useState("");

  if (!isLoaded) return <div data-testid="msm-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "博物館典藏卡";
  const prompt = config?.prompt ?? "如果你能捐贈一件物品給博物館，你會選什麼？";
  const entries = (state.entries ?? []) as MuseumEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = description.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: MuseumEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      category: selectedCategory,
      description: description.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setDescription("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="msm-title" className="text-xl font-bold text-center text-stone-700">{title}</h2>
      <p data-testid="msm-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="msm-count" className="text-center text-xs text-gray-400">已典藏：{entries.length} 件</p>

      {!myEntry && !revealed && (
        <div data-testid="msm-form" className="space-y-3">
          <div data-testid="msm-category-grid" className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`msm-category-${c.id}`}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedCategory === c.id ? "bg-stone-100 border-stone-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="font-medium text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="msm-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述這件物品以及它對你的意義（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <button
            data-testid="msm-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-stone-600 text-white font-medium disabled:opacity-40"
          >
            典藏入館
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="msm-my-entry" className="bg-stone-50 border border-stone-200 rounded-lg p-3">
          <p className="text-sm font-medium text-stone-700">我的典藏已登錄</p>
          <p className="text-xs text-gray-500 mt-1">{CATEGORIES.find((c) => c.id === myEntry.category)?.label} — {myEntry.description}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="msm-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          開放展覽
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="msm-empty" className="text-center text-gray-400 py-8">典藏館尚無藏品</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="msm-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`msm-card-${e.entryId}`} className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CATEGORIES.find((c) => c.id === e.category)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-stone-600 bg-stone-50 px-2 py-0.5 rounded-full">{CATEGORIES.find((c) => c.id === e.category)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
