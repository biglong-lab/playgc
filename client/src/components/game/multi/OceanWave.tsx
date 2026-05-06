import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface WaveEntry {
  entryId: string;
  userId: string;
  userName: string;
  waveType: string;
  feeling: string;
}

interface OceanWaveState extends Record<string, unknown> {
  entries: WaveEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: OceanWaveState = { entries: [], revealed: false };

const WAVE_TYPES = [
  { id: "ripple", label: "漣漪", icon: "🌊", desc: "輕柔微動，穩定前行" },
  { id: "swell", label: "湧浪", icon: "🏄", desc: "逐漸累積，充滿動力" },
  { id: "surge", label: "浪潮", icon: "💪", desc: "強勁推進，勢不可擋" },
  { id: "crash", label: "驚濤", icon: "⚡", desc: "衝破阻礙，全力釋放" },
  { id: "calm", label: "靜海", icon: "😌", desc: "風平浪靜，沉澱思緒" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function OceanWave({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<OceanWaveState>({
    gameId,
    sessionId,
    pageId,
    type: "ocean_wave",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedWave, setSelectedWave] = useState("ripple");
  const [feeling, setFeeling] = useState("");

  if (!isLoaded) return <div data-testid="ocw-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "海浪能量";
  const prompt = config?.prompt ?? "此刻你的能量像哪種海浪？";
  const entries = (state.entries ?? []) as WaveEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = feeling.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: WaveEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      waveType: selectedWave,
      feeling: feeling.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setFeeling("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="ocw-title" className="text-xl font-bold text-center text-blue-800">{title}</h2>
      <p data-testid="ocw-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="ocw-count" className="text-center text-xs text-gray-400">已湧入：{entries.length} 道浪</p>

      {!myEntry && !revealed && (
        <div data-testid="ocw-form" className="space-y-3">
          <div data-testid="ocw-wave-grid" className="grid grid-cols-1 gap-2">
            {WAVE_TYPES.map((w) => (
              <button
                key={w.id}
                data-testid={`ocw-wave-${w.id}`}
                onClick={() => setSelectedWave(w.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedWave === w.id ? "bg-blue-100 border-blue-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{w.icon}</span>
                <div>
                  <p className="font-medium text-sm">{w.label}</p>
                  <p className="text-xs text-gray-500">{w.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ocw-feeling-input"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            placeholder="說說你現在的能量狀態（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            data-testid="ocw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40"
          >
            乘風破浪
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="ocw-my-entry" className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-700">我的浪已湧入</p>
          <p className="text-xs text-gray-500 mt-1">{WAVE_TYPES.find((w) => w.id === myEntry.waveType)?.label} — {myEntry.feeling}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ocw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展開海浪圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ocw-empty" className="text-center text-gray-400 py-8">海面還是平靜的</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ocw-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`ocw-card-${e.entryId}`} className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{WAVE_TYPES.find((w) => w.id === e.waveType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{WAVE_TYPES.find((w) => w.id === e.waveType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.feeling}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
