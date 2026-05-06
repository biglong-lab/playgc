import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LotusBloomEntry {
  entryId: string;
  userId: string;
  userName: string;
  bloomStage: string;
  purity: string;
}

interface LotusBloomState extends Record<string, unknown> {
  entries: LotusBloomEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: LotusBloomState = { entries: [], revealed: false };

const BLOOM_STAGES = [
  { id: "bud", label: "花苞", icon: "🌱", desc: "蓄勢待發，靜待時機" },
  { id: "half_open", label: "半開", icon: "🌷", desc: "含苞欲放，嬌羞可愛" },
  { id: "full_bloom", label: "盛開", icon: "🌸", desc: "出淤泥而不染，全然綻放" },
  { id: "petal_fall", label: "落瓣", icon: "🍃", desc: "優雅凋落，美麗永存" },
  { id: "seed_pod", label: "蓮蓬", icon: "🌿", desc: "化作種子，孕育新生" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function LotusBloom({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LotusBloomState>({
    gameId,
    sessionId,
    pageId,
    type: "lotus_bloom",
    defaultState: DEFAULT_STATE,
  });

  const [selectedStage, setSelectedStage] = useState("full_bloom");
  const [purity, setPurity] = useState("");

  if (!isLoaded) return <div data-testid="ltb-loading">載入中...</div>;

  const title = config?.title ?? "蓮花盛開";
  const prompt = config?.prompt ?? "選擇你此刻的蓮花狀態，分享你出淤泥而不染的心境";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = purity.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: LotusBloomEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      bloomStage: selectedStage,
      purity: purity.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setPurity("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ltb-title" className="text-2xl font-bold text-rose-600">
        {title}
      </h2>
      <p data-testid="ltb-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ltb-count" className="text-sm text-gray-500">
        已盛開 {state.entries.length} 朵蓮花
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ltb-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {BLOOM_STAGES.map((bs) => (
              <button
                key={bs.id}
                data-testid={`ltb-stage-${bs.id}`}
                onClick={() => setSelectedStage(bs.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedStage === bs.id
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-gray-200 hover:border-rose-300"
                }`}
              >
                <div className="text-xl">{bs.icon}</div>
                <div className="text-xs font-medium">{bs.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{bs.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ltb-purity-input"
            value={purity}
            onChange={(e) => setPurity(e.target.value)}
            placeholder="寫下你的心境與感悟..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-rose-400 focus:outline-none"
          />
          <button
            data-testid="ltb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-rose-500 text-white font-semibold disabled:opacity-40"
          >
            盛開蓮花 🌸
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ltb-my-entry" className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
          <p className="text-sm text-rose-600 font-medium">
            {BLOOM_STAGES.find((b) => b.id === myEntry.bloomStage)?.icon}{" "}
            {BLOOM_STAGES.find((b) => b.id === myEntry.bloomStage)?.label}
          </p>
          <p className="text-gray-700">{myEntry.purity}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ltb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-red-600 text-white font-semibold"
        >
          揭曉所有蓮花 🌸
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ltb-empty" className="text-center text-gray-400 py-8">
          蓮池中尚無蓮花
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ltb-result" className="space-y-3">
          <h3 className="font-semibold text-rose-600">所有蓮花已揭曉</h3>
          {state.entries.map((entry) => {
            const bs = BLOOM_STAGES.find((b) => b.id === entry.bloomStage);
            return (
              <div
                key={entry.entryId}
                data-testid={`ltb-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-rose-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{bs?.icon}</span>
                  <span className="font-medium text-rose-700">{bs?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.purity}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
