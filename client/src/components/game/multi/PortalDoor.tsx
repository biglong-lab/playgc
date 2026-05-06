import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface PortalEntry {
  entryId: string;
  userId: string;
  userName: string;
  destination: string;
  reason: string;
}

interface PortalDoorState extends Record<string, unknown> {
  entries: PortalEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: PortalDoorState = { entries: [], revealed: false };

const DESTINATIONS = [
  { id: "dream_world", label: "夢中世界", icon: "🌙", desc: "進入你最美麗的夢境" },
  { id: "childhood", label: "童年記憶", icon: "🎠", desc: "回到最純真的時光" },
  { id: "future", label: "未來世界", icon: "🚀", desc: "穿越到 100 年後" },
  { id: "parallel", label: "平行宇宙", icon: "🌀", desc: "遇見另一個自己" },
  { id: "secret_garden", label: "秘密花園", icon: "🌺", desc: "通往神秘寧靜之所" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function PortalDoor({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<PortalDoorState>({
    gameId,
    sessionId,
    pageId,
    type: "portal_door",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedDest, setSelectedDest] = useState("dream_world");
  const [reason, setReason] = useState("");

  if (!isLoaded) return <div data-testid="pdr-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "任意門";
  const prompt = config?.prompt ?? "如果你有一扇任意門，你想去哪裡？";
  const entries = (state.entries ?? []) as PortalEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = reason.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: PortalEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      destination: selectedDest,
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
      <h2 data-testid="pdr-title" className="text-xl font-bold text-center text-violet-800">{title}</h2>
      <p data-testid="pdr-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="pdr-count" className="text-center text-xs text-gray-400">已打開：{entries.length} 扇門</p>

      {!myEntry && !revealed && (
        <div data-testid="pdr-form" className="space-y-3">
          <div data-testid="pdr-dest-grid" className="grid grid-cols-1 gap-2">
            {DESTINATIONS.map((d) => (
              <button
                key={d.id}
                data-testid={`pdr-dest-${d.id}`}
                onClick={() => setSelectedDest(d.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedDest === d.id ? "bg-violet-100 border-violet-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{d.icon}</span>
                <div>
                  <p className="font-medium text-sm">{d.label}</p>
                  <p className="text-xs text-gray-500">{d.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pdr-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="告訴我們你為什麼選這扇門（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            data-testid="pdr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-violet-600 text-white font-medium disabled:opacity-40"
          >
            打開任意門
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="pdr-my-entry" className="bg-violet-50 border border-violet-200 rounded-lg p-3">
          <p className="text-sm font-medium text-violet-700">我的門已打開</p>
          <p className="text-xs text-gray-500 mt-1">{DESTINATIONS.find((d) => d.id === myEntry.destination)?.label} — {myEntry.reason}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pdr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          開啟所有任意門
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pdr-empty" className="text-center text-gray-400 py-8">還沒有人打開任意門</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pdr-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`pdr-card-${e.entryId}`} className="bg-white border border-violet-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{DESTINATIONS.find((d) => d.id === e.destination)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{DESTINATIONS.find((d) => d.id === e.destination)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
