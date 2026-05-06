import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface VolcanoEntry {
  entryId: string;
  userId: string;
  userName: string;
  state: string;
  message: string;
}

interface VolcanoReportState extends Record<string, unknown> {
  entries: VolcanoEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: VolcanoReportState = { entries: [], revealed: false };

const VOLCANO_STATES = [
  { id: "dormant", label: "休眠中", icon: "😴", desc: "需要時間充電" },
  { id: "warming", label: "升溫蓄積", icon: "🌡️", desc: "慢慢熱起來了" },
  { id: "active", label: "活躍運作", icon: "🔥", desc: "狀態很好，持續輸出" },
  { id: "erupting", label: "全力爆發", icon: "🌋", desc: "能量超滿，衝！" },
  { id: "cooling", label: "冷卻中", icon: "❄️", desc: "需要休息補能量" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function VolcanoReport({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<VolcanoReportState>({
    gameId,
    sessionId,
    pageId,
    type: "volcano_report",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedState, setSelectedState] = useState("active");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <div data-testid="vlc-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "火山報告";
  const prompt = config?.prompt ?? "你現在的能量狀態像哪座火山？說說你的狀況";
  const entries = (state.entries ?? []) as VolcanoEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = message.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: VolcanoEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      state: selectedState,
      message: message.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setMessage("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="vlc-title" className="text-xl font-bold text-center text-red-700">{title}</h2>
      <p data-testid="vlc-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="vlc-count" className="text-center text-xs text-gray-400">已回報：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="vlc-form" className="space-y-3">
          <div data-testid="vlc-state-grid" className="grid grid-cols-1 gap-2">
            {VOLCANO_STATES.map((s) => (
              <button
                key={s.id}
                data-testid={`vlc-state-${s.id}`}
                onClick={() => setSelectedState(s.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedState === s.id ? "bg-red-100 border-red-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="vlc-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="說說你現在的狀態或需要什麼支持（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            data-testid="vlc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-red-500 text-white font-medium disabled:opacity-40"
          >
            送出能量報告
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="vlc-my-entry" className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm font-medium text-red-700">我的能量報告已送出</p>
          <p className="text-xs text-gray-500 mt-1">{VOLCANO_STATES.find((s) => s.id === myEntry.state)?.label} — {myEntry.message}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="vlc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭曉團隊能量圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="vlc-empty" className="text-center text-gray-400 py-8">還沒有人回報</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="vlc-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`vlc-card-${e.entryId}`} className="bg-white border border-red-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{VOLCANO_STATES.find((s) => s.id === e.state)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{VOLCANO_STATES.find((s) => s.id === e.state)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
