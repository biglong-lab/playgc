import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface PinEntry {
  entryId: string;
  userId: string;
  userName: string;
  pinType: string;
  location: string;
}

interface MapPinState extends Record<string, unknown> {
  entries: PinEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: MapPinState = { entries: [], revealed: false };

const PIN_TYPES = [
  { id: "start", label: "起點", icon: "🚀", desc: "一切從這裡出發" },
  { id: "destination", label: "目的地", icon: "🏁", desc: "我想抵達的終點" },
  { id: "rest", label: "休息站", icon: "⛺", desc: "補充能量，休整一下" },
  { id: "surprise", label: "驚喜點", icon: "🎁", desc: "意外發現的美好地方" },
  { id: "detour", label: "迷路處", icon: "🗺️", desc: "走錯路也是一種體驗" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function MapPin({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<MapPinState>({
    gameId,
    sessionId,
    pageId,
    type: "map_pin",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedPin, setSelectedPin] = useState("start");
  const [location, setLocation] = useState("");

  if (!isLoaded) return <div data-testid="mpn-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "地圖釘";
  const prompt = config?.prompt ?? "你現在在旅程的哪個位置？";
  const entries = (state.entries ?? []) as PinEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = location.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: PinEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      pinType: selectedPin,
      location: location.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setLocation("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="mpn-title" className="text-xl font-bold text-center text-teal-800">{title}</h2>
      <p data-testid="mpn-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="mpn-count" className="text-center text-xs text-gray-400">已標記：{entries.length} 個位置</p>

      {!myEntry && !revealed && (
        <div data-testid="mpn-form" className="space-y-3">
          <div data-testid="mpn-pin-grid" className="grid grid-cols-1 gap-2">
            {PIN_TYPES.map((p) => (
              <button
                key={p.id}
                data-testid={`mpn-pin-${p.id}`}
                onClick={() => setSelectedPin(p.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedPin === p.id ? "bg-teal-100 border-teal-500" : "bg-white border-gray-200"}`}
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
            data-testid="mpn-location-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="說說你現在在旅程的哪裡（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            data-testid="mpn-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-teal-600 text-white font-medium disabled:opacity-40"
          >
            釘上地圖
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="mpn-my-entry" className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <p className="text-sm font-medium text-teal-700">我的位置已標記</p>
          <p className="text-xs text-gray-500 mt-1">{PIN_TYPES.find((p) => p.id === myEntry.pinType)?.label} — {myEntry.location}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mpn-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展開地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mpn-empty" className="text-center text-gray-400 py-8">地圖還沒有任何標記</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mpn-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`mpn-card-${e.entryId}`} className="bg-white border border-teal-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{PIN_TYPES.find((p) => p.id === e.pinType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">{PIN_TYPES.find((p) => p.id === e.pinType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
