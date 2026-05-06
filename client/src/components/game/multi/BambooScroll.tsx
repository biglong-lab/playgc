import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BambooScrollEntry {
  entryId: string;
  userId: string;
  userName: string;
  scrollType: string;
  inscription: string;
}

interface BambooScrollState extends Record<string, unknown> {
  entries: BambooScrollEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: BambooScrollState = { entries: [], revealed: false };

const SCROLL_TYPES = [
  { id: "wisdom", label: "智語", icon: "📜", desc: "一句你深信的人生道理" },
  { id: "story", label: "故事", icon: "📖", desc: "一段難忘的人生片段" },
  { id: "oath", label: "誓言", icon: "⚔️", desc: "對自己或他人的莊嚴承諾" },
  { id: "prophecy", label: "預言", icon: "🔮", desc: "你對未來的直覺預感" },
  { id: "blessing", label: "祝福", icon: "🙏", desc: "獻給在場所有人的美好心意" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function BambooScroll({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BambooScrollState>({
    gameId,
    sessionId,
    pageId,
    type: "bamboo_scroll",
    defaultState: DEFAULT_STATE,
  });

  const [selectedType, setSelectedType] = useState("wisdom");
  const [inscription, setInscription] = useState("");

  if (!isLoaded) return <div data-testid="bbs-loading">載入中...</div>;

  const title = config?.title ?? "竹簡";
  const prompt = config?.prompt ?? "展開你的竹簡，刻下那句只有你能說出的話";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = inscription.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: BambooScrollEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      scrollType: selectedType,
      inscription: inscription.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setInscription("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="bbs-title" className="text-2xl font-bold text-amber-800">
        {title}
      </h2>
      <p data-testid="bbs-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="bbs-count" className="text-sm text-gray-500">
        已刻下 {state.entries.length} 捲竹簡
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="bbs-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {SCROLL_TYPES.map((st) => (
              <button
                key={st.id}
                data-testid={`bbs-type-${st.id}`}
                onClick={() => setSelectedType(st.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedType === st.id
                    ? "border-amber-600 bg-amber-50 text-amber-800"
                    : "border-gray-200 hover:border-amber-400"
                }`}
              >
                <div className="text-xl">{st.icon}</div>
                <div className="text-xs font-medium">{st.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{st.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="bbs-inscription-input"
            value={inscription}
            onChange={(e) => setInscription(e.target.value)}
            placeholder="刻下你的文字..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
          <button
            data-testid="bbs-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-amber-700 text-white font-semibold disabled:opacity-40"
          >
            封存竹簡 📜
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="bbs-my-entry" className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
          <p className="text-sm text-amber-700 font-medium">
            {SCROLL_TYPES.find((s) => s.id === myEntry.scrollType)?.icon}{" "}
            {SCROLL_TYPES.find((s) => s.id === myEntry.scrollType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.inscription}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="bbs-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-green-700 text-white font-semibold"
        >
          開啟所有竹簡 📜
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="bbs-empty" className="text-center text-gray-400 py-8">
          竹簡尚無刻文
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="bbs-result" className="space-y-3">
          <h3 className="font-semibold text-amber-800">所有竹簡已開啟</h3>
          {state.entries.map((entry) => {
            const st = SCROLL_TYPES.find((s) => s.id === entry.scrollType);
            return (
              <div
                key={entry.entryId}
                data-testid={`bbs-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-amber-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{st?.icon}</span>
                  <span className="font-medium text-amber-800">{st?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.inscription}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
