import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SpiralShellEntry {
  entryId: string;
  userId: string;
  userName: string;
  shellType: string;
  echo: string;
}

interface SpiralShellState extends Record<string, unknown> {
  entries: SpiralShellEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SpiralShellState = { entries: [], revealed: false };

const SHELL_TYPES = [
  { id: "nautilus", label: "鸚鵡螺", icon: "🐚", desc: "螺旋成長，無限延伸" },
  { id: "conch", label: "法螺", icon: "📯", desc: "貝聲悠揚，傳遞遠方" },
  { id: "cowrie", label: "寶貝螺", icon: "💠", desc: "珍貴稀有，守護財富" },
  { id: "turban", label: "蠑螺", icon: "🌀", desc: "堅硬外殼，柔軟內心" },
  { id: "moon_snail", label: "月螺", icon: "🌙", desc: "月光溫柔，靜謐守候" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SpiralShell({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SpiralShellState>({
    gameId,
    sessionId,
    pageId,
    type: "spiral_shell",
    defaultState: DEFAULT_STATE,
  });

  const [selectedShell, setSelectedShell] = useState("nautilus");
  const [echo, setEcho] = useState("");

  if (!isLoaded) return <div data-testid="sps-loading">載入中...</div>;

  const title = config?.title ?? "螺旋貝心聲";
  const prompt = config?.prompt ?? "把耳朵貼近貝殼，聽見你心底最深處的回聲";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = echo.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: SpiralShellEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      shellType: selectedShell,
      echo: echo.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setEcho("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="sps-title" className="text-2xl font-bold text-teal-700">
        {title}
      </h2>
      <p data-testid="sps-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="sps-count" className="text-sm text-gray-500">
        已聆聽 {state.entries.length} 顆貝殼
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="sps-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {SHELL_TYPES.map((st) => (
              <button
                key={st.id}
                data-testid={`sps-shell-${st.id}`}
                onClick={() => setSelectedShell(st.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedShell === st.id
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-gray-200 hover:border-teal-300"
                }`}
              >
                <div className="text-xl">{st.icon}</div>
                <div className="text-xs font-medium">{st.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{st.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sps-echo-input"
            value={echo}
            onChange={(e) => setEcho(e.target.value)}
            placeholder="寫下你從貝殼中聽見的回聲..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-teal-400 focus:outline-none"
          />
          <button
            data-testid="sps-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-teal-500 text-white font-semibold disabled:opacity-40"
          >
            傾聽回聲 🐚
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="sps-my-entry" className="p-4 bg-teal-50 rounded-xl border border-teal-200 space-y-1">
          <p className="text-sm text-teal-600 font-medium">
            {SHELL_TYPES.find((s) => s.id === myEntry.shellType)?.icon}{" "}
            {SHELL_TYPES.find((s) => s.id === myEntry.shellType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.echo}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sps-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-cyan-600 text-white font-semibold"
        >
          揭曉所有回聲 🐚
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="sps-empty" className="text-center text-gray-400 py-8">
          海邊尚無貝殼聲音
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="sps-result" className="space-y-3">
          <h3 className="font-semibold text-teal-700">所有回聲已揭曉</h3>
          {state.entries.map((entry) => {
            const st = SHELL_TYPES.find((s) => s.id === entry.shellType);
            return (
              <div
                key={entry.entryId}
                data-testid={`sps-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-teal-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{st?.icon}</span>
                  <span className="font-medium text-teal-700">{st?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.echo}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
