import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface BookmarkEntry {
  entryId: string;
  userId: string;
  userName: string;
  chapter: string;
  reflection: string;
}

interface BookmarkCardState extends Record<string, unknown> {
  entries: BookmarkEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: BookmarkCardState = { entries: [], revealed: false };

const CHAPTERS = [
  { id: "new_chapter", label: "新篇章", icon: "📖", desc: "翻開嶄新的一頁" },
  { id: "climax", label: "高潮時刻", icon: "⚡", desc: "最精彩的關鍵時刻" },
  { id: "plot_twist", label: "轉折點", icon: "🔀", desc: "意外的劇情改變" },
  { id: "epilogue", label: "後記沉澱", icon: "🌅", desc: "整合收穫，深度反思" },
  { id: "blank_page", label: "空白頁", icon: "📄", desc: "等待被填寫的可能" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function BookmarkCard({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<BookmarkCardState>({
    gameId,
    sessionId,
    pageId,
    type: "bookmark_card",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedChapter, setSelectedChapter] = useState("new_chapter");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="bmk-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "人生書籤卡";
  const prompt = config?.prompt ?? "你現在在人生故事的哪一頁？";
  const entries = (state.entries ?? []) as BookmarkEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: BookmarkEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      chapter: selectedChapter,
      reflection: reflection.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setReflection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="bmk-title" className="text-xl font-bold text-center text-amber-800">{title}</h2>
      <p data-testid="bmk-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="bmk-count" className="text-center text-xs text-gray-400">已夾入：{entries.length} 張書籤</p>

      {!myEntry && !revealed && (
        <div data-testid="bmk-form" className="space-y-3">
          <div data-testid="bmk-chapter-grid" className="grid grid-cols-1 gap-2">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                data-testid={`bmk-chapter-${c.id}`}
                onClick={() => setSelectedChapter(c.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedChapter === c.id ? "bg-amber-100 border-amber-500" : "bg-white border-gray-200"}`}
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
            data-testid="bmk-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="說說你現在這一頁的故事（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            data-testid="bmk-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            夾入書籤
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="bmk-my-entry" className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-700">我的書籤已夾入</p>
          <p className="text-xs text-gray-500 mt-1">{CHAPTERS.find((c) => c.id === myEntry.chapter)?.label} — {myEntry.reflection}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="bmk-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          翻開書本
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="bmk-empty" className="text-center text-gray-400 py-8">書本還沒有書籤</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="bmk-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`bmk-card-${e.entryId}`} className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CHAPTERS.find((c) => c.id === e.chapter)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{CHAPTERS.find((c) => c.id === e.chapter)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.reflection}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
