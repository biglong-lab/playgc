import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface LampEntry {
  entryId: string;
  userId: string;
  userName: string;
  lightType: string;
  message: string;
}

interface LampLightState extends Record<string, unknown> {
  entries: LampEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: LampLightState = { entries: [], revealed: false };

const LIGHT_TYPES = [
  { id: "warm", label: "暖光", icon: "🕯️", desc: "溫暖舒適，像家的感覺" },
  { id: "cool", label: "冷光", icon: "💡", desc: "清晰聚焦，思緒明亮" },
  { id: "flicker", label: "閃爍", icon: "✨", desc: "充滿活力，靈感連連" },
  { id: "soft", label: "柔和", icon: "🌟", desc: "輕柔擴散，平靜安定" },
  { id: "bright", label: "明亮", icon: "☀️", desc: "光芒四射，充滿能量" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function LampLight({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<LampLightState>({
    gameId,
    sessionId,
    pageId,
    type: "lamp_light",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedLight, setSelectedLight] = useState("warm");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <div data-testid="lmp-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "心燈";
  const prompt = config?.prompt ?? "此刻你的內心是什麼樣的光？";
  const entries = (state.entries ?? []) as LampEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = message.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: LampEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      lightType: selectedLight,
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
      <h2 data-testid="lmp-title" className="text-xl font-bold text-center text-yellow-800">{title}</h2>
      <p data-testid="lmp-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="lmp-count" className="text-center text-xs text-gray-400">已點亮：{entries.length} 盞燈</p>

      {!myEntry && !revealed && (
        <div data-testid="lmp-form" className="space-y-3">
          <div data-testid="lmp-light-grid" className="grid grid-cols-1 gap-2">
            {LIGHT_TYPES.map((l) => (
              <button
                key={l.id}
                data-testid={`lmp-light-${l.id}`}
                onClick={() => setSelectedLight(l.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedLight === l.id ? "bg-yellow-100 border-yellow-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{l.icon}</span>
                <div>
                  <p className="font-medium text-sm">{l.label}</p>
                  <p className="text-xs text-gray-500">{l.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="lmp-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="說說你現在的光是什麼感覺（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button
            data-testid="lmp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-yellow-600 text-white font-medium disabled:opacity-40"
          >
            點亮心燈
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="lmp-my-entry" className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-700">我的心燈已點亮</p>
          <p className="text-xs text-gray-500 mt-1">{LIGHT_TYPES.find((l) => l.id === myEntry.lightType)?.label} — {myEntry.message}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="lmp-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展示所有心燈
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="lmp-empty" className="text-center text-gray-400 py-8">燈火闌珊，還沒有人點燈</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="lmp-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`lmp-card-${e.entryId}`} className="bg-white border border-yellow-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{LIGHT_TYPES.find((l) => l.id === e.lightType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{LIGHT_TYPES.find((l) => l.id === e.lightType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
