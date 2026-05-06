import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface TreeRingEntry {
  entryId: string;
  userId: string;
  userName: string;
  ringType: string;
  reflection: string;
}

interface TreeRingState extends Record<string, unknown> {
  entries: TreeRingEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: TreeRingState = { entries: [], revealed: false };

const RING_TYPES = [
  { id: "resilience", label: "韌性之環", icon: "🌳", desc: "在逆境中變得更強" },
  { id: "expansion", label: "擴展之環", icon: "🌿", desc: "向外延伸，拓展邊界" },
  { id: "depth", label: "深根之環", icon: "🌱", desc: "向內深挖，累積底蘊" },
  { id: "healing", label: "癒合之環", icon: "💧", desc: "修復傷口，重新出發" },
  { id: "adaptation", label: "適應之環", icon: "🍂", desc: "隨環境調整，順勢而為" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function TreeRing({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TreeRingState>({
    gameId,
    sessionId,
    pageId,
    type: "tree_ring",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedRing, setSelectedRing] = useState("resilience");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="trr-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "年輪成長卡";
  const prompt = config?.prompt ?? "這段時間你為自己的生命之樹新增了哪種年輪？";
  const entries = (state.entries ?? []) as TreeRingEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: TreeRingEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      ringType: selectedRing,
      reflection: reflection.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setReflection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="trr-title" className="text-xl font-bold text-center text-green-800">{title}</h2>
      <p data-testid="trr-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="trr-count" className="text-center text-xs text-gray-400">已記錄：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="trr-form" className="space-y-3">
          <div data-testid="trr-ring-grid" className="grid grid-cols-1 gap-2">
            {RING_TYPES.map((r) => (
              <button
                key={r.id}
                data-testid={`trr-ring-${r.id}`}
                onClick={() => setSelectedRing(r.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedRing === r.id ? "bg-green-100 border-green-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{r.icon}</span>
                <div>
                  <p className="font-medium text-sm">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="trr-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="說說你這段時間的成長故事（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            data-testid="trr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-40"
          >
            刻下年輪
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="trr-my-entry" className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-700">我的年輪已刻下</p>
          <p className="text-xs text-gray-500 mt-1">{RING_TYPES.find((r) => r.id === myEntry.ringType)?.label} — {myEntry.reflection}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="trr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展開年輪圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="trr-empty" className="text-center text-gray-400 py-8">年輪圖還是空白的</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="trr-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`trr-card-${e.entryId}`} className="bg-white border border-green-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{RING_TYPES.find((r) => r.id === e.ringType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{RING_TYPES.find((r) => r.id === e.ringType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.reflection}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
