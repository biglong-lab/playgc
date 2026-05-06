import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AwardEntry {
  entryId: string;
  userId: string;
  userName: string;
  category: string;
  nomination: string;
}

interface AwardCeremonyState extends Record<string, unknown> {
  entries: AwardEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: AwardCeremonyState = { entries: [], revealed: false };

const CATEGORIES = [
  { id: "effort", label: "最努力獎", icon: "💪", desc: "永不放棄" },
  { id: "creativity", label: "最有創意獎", icon: "🎨", desc: "點子滿滿" },
  { id: "support", label: "最佳支援獎", icon: "🤝", desc: "助人為樂" },
  { id: "leadership", label: "最佳領袖獎", icon: "👑", desc: "帶領向前" },
  { id: "humor", label: "搞笑王獎", icon: "😂", desc: "帶來歡笑" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function AwardCeremony({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<AwardCeremonyState>({
    gameId,
    sessionId,
    pageId,
    type: "award_ceremony",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("effort");
  const [nomination, setNomination] = useState("");

  if (!isLoaded) return <div data-testid="awd-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "頒獎典禮";
  const prompt = config?.prompt ?? "選一個獎項，提名你心目中最符合的人（或說明你的理由）";
  const entries = (state.entries ?? []) as AwardEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = nomination.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: AwardEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      category: selectedCategory,
      nomination: nomination.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setNomination("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="awd-title" className="text-xl font-bold text-center text-amber-700">{title}</h2>
      <p data-testid="awd-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="awd-count" className="text-center text-xs text-gray-400">已提名：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="awd-form" className="space-y-3">
          <div data-testid="awd-category-grid" className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`awd-category-${c.id}`}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedCategory === c.id ? "bg-amber-100 border-amber-400" : "bg-white border-gray-200"}`}
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
            data-testid="awd-nomination-input"
            value={nomination}
            onChange={(e) => setNomination(e.target.value)}
            placeholder="寫下你的提名理由或被提名者（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            data-testid="awd-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-amber-500 text-white font-medium disabled:opacity-40"
          >
            送出提名
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="awd-my-entry" className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-700">我的提名已送出</p>
          <p className="text-xs text-gray-500 mt-1">{CATEGORIES.find((c) => c.id === myEntry.category)?.label} — {myEntry.nomination}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="awd-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭曉所有提名
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="awd-empty" className="text-center text-gray-400 py-8">還沒有人提名</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="awd-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`awd-card-${e.entryId}`} className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CATEGORIES.find((c) => c.id === e.category)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{CATEGORIES.find((c) => c.id === e.category)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.nomination}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
