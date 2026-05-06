import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface FireworkEntry {
  entryId: string;
  userId: string;
  userName: string;
  burstType: string;
  celebration: string;
}

interface FireworkBurstState extends Record<string, unknown> {
  entries: FireworkEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: FireworkBurstState = { entries: [], revealed: false };

const BURST_TYPES = [
  { id: "sparkle", label: "閃光彈", icon: "✨", desc: "小小驚喜，點亮時刻" },
  { id: "meteor", label: "流星雨", icon: "🌠", desc: "一閃而過，留下痕跡" },
  { id: "bloom", label: "菊花展", icon: "🎆", desc: "層層綻放，精彩豐富" },
  { id: "rainbow", label: "彩虹炸", icon: "🌈", desc: "五彩繽紛，充滿歡樂" },
  { id: "grand", label: "大爆發", icon: "🎇", desc: "全力燃燒，震撼全場" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function FireworkBurst({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<FireworkBurstState>({
    gameId,
    sessionId,
    pageId,
    type: "firework_burst",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedBurst, setSelectedBurst] = useState("sparkle");
  const [celebration, setCelebration] = useState("");

  if (!isLoaded) return <div data-testid="fwb-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "煙火爆發";
  const prompt = config?.prompt ?? "你想用什麼煙火慶祝這個時刻？";
  const entries = (state.entries ?? []) as FireworkEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = celebration.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: FireworkEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      burstType: selectedBurst,
      celebration: celebration.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setCelebration("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="fwb-title" className="text-xl font-bold text-center text-rose-800">{title}</h2>
      <p data-testid="fwb-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="fwb-count" className="text-center text-xs text-gray-400">已施放：{entries.length} 發煙火</p>

      {!myEntry && !revealed && (
        <div data-testid="fwb-form" className="space-y-3">
          <div data-testid="fwb-burst-grid" className="grid grid-cols-1 gap-2">
            {BURST_TYPES.map((b) => (
              <button
                key={b.id}
                data-testid={`fwb-burst-${b.id}`}
                onClick={() => setSelectedBurst(b.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedBurst === b.id ? "bg-rose-100 border-rose-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{b.icon}</span>
                <div>
                  <p className="font-medium text-sm">{b.label}</p>
                  <p className="text-xs text-gray-500">{b.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="fwb-celebration-input"
            value={celebration}
            onChange={(e) => setCelebration(e.target.value)}
            placeholder="說說你想慶祝什麼（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button
            data-testid="fwb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-rose-600 text-white font-medium disabled:opacity-40"
          >
            施放煙火
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="fwb-my-entry" className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-sm font-medium text-rose-700">我的煙火已施放</p>
          <p className="text-xs text-gray-500 mt-1">{BURST_TYPES.find((b) => b.id === myEntry.burstType)?.label} — {myEntry.celebration}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="fwb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          點燃所有煙火
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="fwb-empty" className="text-center text-gray-400 py-8">夜空還沒有煙火</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="fwb-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`fwb-card-${e.entryId}`} className="bg-white border border-rose-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{BURST_TYPES.find((b) => b.id === e.burstType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">{BURST_TYPES.find((b) => b.id === e.burstType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.celebration}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
