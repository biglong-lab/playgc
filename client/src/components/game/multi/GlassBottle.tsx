import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface BottleEntry {
  entryId: string;
  userId: string;
  userName: string;
  messageType: string;
  letter: string;
}

interface GlassBottleState extends Record<string, unknown> {
  entries: BottleEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: GlassBottleState = { entries: [], revealed: false };

const MESSAGE_TYPES = [
  { id: "hope", label: "希望", icon: "🌟", desc: "對未來的美好期望" },
  { id: "gratitude", label: "感謝", icon: "💝", desc: "心中深藏的感激" },
  { id: "apology", label: "道歉", icon: "🌸", desc: "想說但說不出口的抱歉" },
  { id: "promise", label: "期許", icon: "🎯", desc: "對自己或他人的承諾" },
  { id: "secret", label: "秘密", icon: "🔐", desc: "藏在心底的小秘密" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function GlassBottle({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<GlassBottleState>({
    gameId,
    sessionId,
    pageId,
    type: "glass_bottle",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState("hope");
  const [letter, setLetter] = useState("");

  if (!isLoaded) return <div data-testid="glb-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "玻璃瓶漂流信";
  const prompt = config?.prompt ?? "你想把什麼裝進漂流瓶裡？";
  const entries = (state.entries ?? []) as BottleEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = letter.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: BottleEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      messageType: selectedType,
      letter: letter.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setLetter("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="glb-title" className="text-xl font-bold text-center text-cyan-800">{title}</h2>
      <p data-testid="glb-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="glb-count" className="text-center text-xs text-gray-400">已放出：{entries.length} 個漂流瓶</p>

      {!myEntry && !revealed && (
        <div data-testid="glb-form" className="space-y-3">
          <div data-testid="glb-type-grid" className="grid grid-cols-1 gap-2">
            {MESSAGE_TYPES.map((m) => (
              <button
                key={m.id}
                data-testid={`glb-type-${m.id}`}
                onClick={() => setSelectedType(m.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedType === m.id ? "bg-cyan-100 border-cyan-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{m.icon}</span>
                <div>
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="glb-letter-input"
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            placeholder="寫下你想放進漂流瓶的話（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            data-testid="glb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-cyan-600 text-white font-medium disabled:opacity-40"
          >
            投入大海
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="glb-my-entry" className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <p className="text-sm font-medium text-cyan-700">我的漂流瓶已放出</p>
          <p className="text-xs text-gray-500 mt-1">{MESSAGE_TYPES.find((m) => m.id === myEntry.messageType)?.label} — {myEntry.letter}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="glb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          打撈漂流瓶
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="glb-empty" className="text-center text-gray-400 py-8">海上還沒有漂流瓶</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="glb-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`glb-card-${e.entryId}`} className="bg-white border border-cyan-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{MESSAGE_TYPES.find((m) => m.id === e.messageType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full">{MESSAGE_TYPES.find((m) => m.id === e.messageType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.letter}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
