import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface TreasureEntry {
  entryId: string;
  userId: string;
  userName: string;
  treasureType: string;
  value: string;
}

interface TreasureChestState extends Record<string, unknown> {
  entries: TreasureEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: TreasureChestState = { entries: [], revealed: false };

const TREASURE_TYPES = [
  { id: "gold", label: "金幣", icon: "🪙", desc: "積累的財富與成就" },
  { id: "gem", label: "寶石", icon: "💎", desc: "珍貴稀有的才能" },
  { id: "scroll", label: "卷軸", icon: "📜", desc: "智慧與知識的結晶" },
  { id: "artifact", label: "神器", icon: "⚔️", desc: "強大的技能與工具" },
  { id: "map", label: "藏寶圖", icon: "🗺️", desc: "通往未知的指引" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function TreasureChest({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TreasureChestState>({
    gameId,
    sessionId,
    pageId,
    type: "treasure_chest",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedTreasure, setSelectedTreasure] = useState("gold");
  const [value, setValue] = useState("");

  if (!isLoaded) return <div data-testid="trc-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "寶箱";
  const prompt = config?.prompt ?? "你的寶箱裡藏著什麼珍寶？";
  const entries = (state.entries ?? []) as TreasureEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = value.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: TreasureEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      treasureType: selectedTreasure,
      value: value.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setValue("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="trc-title" className="text-xl font-bold text-center text-amber-800">{title}</h2>
      <p data-testid="trc-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="trc-count" className="text-center text-xs text-gray-400">已開啟：{entries.length} 個寶箱</p>

      {!myEntry && !revealed && (
        <div data-testid="trc-form" className="space-y-3">
          <div data-testid="trc-treasure-grid" className="grid grid-cols-1 gap-2">
            {TREASURE_TYPES.map((t) => (
              <button
                key={t.id}
                data-testid={`trc-treasure-${t.id}`}
                onClick={() => setSelectedTreasure(t.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedTreasure === t.id ? "bg-amber-100 border-amber-500" : "bg-white border-gray-200"}`}
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
            data-testid="trc-value-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="說說這份珍寶對你的意義（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            data-testid="trc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-40"
          >
            放入寶箱
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="trc-my-entry" className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-700">我的珍寶已放入寶箱</p>
          <p className="text-xs text-gray-500 mt-1">{TREASURE_TYPES.find((t) => t.id === myEntry.treasureType)?.label} — {myEntry.value}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="trc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          開啟寶箱
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="trc-empty" className="text-center text-gray-400 py-8">寶箱還是空的</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="trc-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`trc-card-${e.entryId}`} className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{TREASURE_TYPES.find((t) => t.id === e.treasureType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{TREASURE_TYPES.find((t) => t.id === e.treasureType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
