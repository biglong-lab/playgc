import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface TimeTravelEntry {
  entryId: string;
  userId: string;
  userName: string;
  period: string;
  reason: string;
}

interface TimeTravelState extends Record<string, unknown> {
  entries: TimeTravelEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: TimeTravelState = { entries: [], revealed: false };

const PERIODS = [
  { id: "prehistoric", label: "史前時代", icon: "🦕", desc: "恐龍與洪荒" },
  { id: "ancient", label: "古代文明", icon: "🏛️", desc: "金字塔與哲人" },
  { id: "industrial", label: "工業革命", icon: "⚙️", desc: "蒸汽與發明" },
  { id: "modern", label: "當代世界", icon: "🌍", desc: "網路與全球化" },
  { id: "future", label: "未來世界", icon: "🚀", desc: "星際與 AI" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function TimeTravel({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TimeTravelState>({
    gameId,
    sessionId,
    pageId,
    type: "time_travel",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("future");
  const [reason, setReason] = useState("");

  if (!isLoaded) return <div data-testid="ttv-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "時光機";
  const prompt = config?.prompt ?? "如果你能搭乘時光機，你最想去哪個時代？";
  const entries = (state.entries ?? []) as TimeTravelEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = reason.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: TimeTravelEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      period: selectedPeriod,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setReason("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="ttv-title" className="text-xl font-bold text-center text-indigo-700">{title}</h2>
      <p data-testid="ttv-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="ttv-count" className="text-center text-xs text-gray-400">已選擇：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="ttv-form" className="space-y-3">
          <div data-testid="ttv-period-grid" className="grid grid-cols-1 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                data-testid={`ttv-period-${p.id}`}
                onClick={() => setSelectedPeriod(p.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedPeriod === p.id ? "bg-indigo-100 border-indigo-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{p.icon}</span>
                <div>
                  <p className="font-medium text-sm">{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ttv-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="說說你為什麼想去那個時代（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            data-testid="ttv-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-indigo-500 text-white font-medium disabled:opacity-40"
          >
            啟動時光機
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="ttv-my-entry" className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <p className="text-sm font-medium text-indigo-700">我的時光機目的地已設定</p>
          <p className="text-xs text-gray-500 mt-1">{PERIODS.find((p) => p.id === myEntry.period)?.label} — {myEntry.reason}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ttv-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭曉所有目的地
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ttv-empty" className="text-center text-gray-400 py-8">還沒有人設定目的地</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ttv-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`ttv-card-${e.entryId}`} className="bg-white border border-indigo-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{PERIODS.find((p) => p.id === e.period)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{PERIODS.find((p) => p.id === e.period)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
