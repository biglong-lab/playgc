import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface TimerEntry {
  entryId: string;
  userId: string;
  userName: string;
  timeFrame: string;
  moment: string;
}

interface SandTimerState extends Record<string, unknown> {
  entries: TimerEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SandTimerState = { entries: [], revealed: false };

const TIME_FRAMES = [
  { id: "past", label: "過去", icon: "⏮️", desc: "那些已流逝的美好時光" },
  { id: "present", label: "現在", icon: "⏸️", desc: "此刻正在發生的一切" },
  { id: "future", label: "未來", icon: "⏭️", desc: "即將到來的可能" },
  { id: "eternal", label: "永恆", icon: "♾️", desc: "跨越時間的不變真理" },
  { id: "fleeting", label: "轉瞬", icon: "⚡", desc: "一閃而逝的珍貴片刻" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SandTimer({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SandTimerState>({
    gameId,
    sessionId,
    pageId,
    type: "sand_timer",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedFrame, setSelectedFrame] = useState("present");
  const [moment, setMoment] = useState("");

  if (!isLoaded) return <div data-testid="sdt-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "沙漏時光";
  const prompt = config?.prompt ?? "你最想珍藏哪個時間的自己？";
  const entries = (state.entries ?? []) as TimerEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = moment.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: TimerEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      timeFrame: selectedFrame,
      moment: moment.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setMoment("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="sdt-title" className="text-xl font-bold text-center text-orange-800">{title}</h2>
      <p data-testid="sdt-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="sdt-count" className="text-center text-xs text-gray-400">已定格：{entries.length} 個時刻</p>

      {!myEntry && !revealed && (
        <div data-testid="sdt-form" className="space-y-3">
          <div data-testid="sdt-frame-grid" className="grid grid-cols-1 gap-2">
            {TIME_FRAMES.map((t) => (
              <button
                key={t.id}
                data-testid={`sdt-frame-${t.id}`}
                onClick={() => setSelectedFrame(t.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedFrame === t.id ? "bg-orange-100 border-orange-500" : "bg-white border-gray-200"}`}
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
            data-testid="sdt-moment-input"
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
            placeholder="說說這個時刻對你的意義（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            data-testid="sdt-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-40"
          >
            定格時光
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="sdt-my-entry" className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-medium text-orange-700">我的時刻已定格</p>
          <p className="text-xs text-gray-500 mt-1">{TIME_FRAMES.find((t) => t.id === myEntry.timeFrame)?.label} — {myEntry.moment}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sdt-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          翻轉沙漏
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sdt-empty" className="text-center text-gray-400 py-8">沙漏裡還沒有時刻</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sdt-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`sdt-card-${e.entryId}`} className="bg-white border border-orange-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{TIME_FRAMES.find((t) => t.id === e.timeFrame)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">{TIME_FRAMES.find((t) => t.id === e.timeFrame)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.moment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
