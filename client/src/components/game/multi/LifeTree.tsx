import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LifeTreeEntry {
  entryId: string;
  userId: string;
  userName: string;
  stage: string;
  note: string;
}

interface LifeTreeState extends Record<string, unknown> {
  entries: LifeTreeEntry[];
  revealed: boolean;
}

interface LifeTreeConfig {
  title?: string;
  prompt?: string;
}

interface LifeTreeProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: LifeTreeConfig;
}

const STAGES = [
  { id: "sprout", label: "萌芽", icon: "🌱", desc: "剛剛起步，充滿可能" },
  { id: "grow", label: "成長", icon: "🌿", desc: "努力學習，向上發展" },
  { id: "bloom", label: "開花", icon: "🌸", desc: "才能展現，發光發熱" },
  { id: "fruit", label: "結果", icon: "🍎", desc: "收穫成果，分享豐收" },
  { id: "fallen", label: "落葉", icon: "🍂", desc: "放手歸零，沉澱智慧" },
  { id: "rest", label: "休眠", icon: "❄️", desc: "靜待時機，蓄積能量" },
];

const CARD_COLORS = [
  "bg-amber-50 border-amber-200",
  "bg-yellow-50 border-yellow-200",
  "bg-lime-50 border-lime-200",
  "bg-green-50 border-green-200",
  "bg-orange-50 border-orange-200",
  "bg-emerald-50 border-emerald-200",
];

export function LifeTree({ gameId, sessionId, pageId, isTeamLead, config }: LifeTreeProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LifeTreeState>({
    gameId,
    sessionId,
    pageId,
    type: "life_tree",
    defaultState: { entries: [], revealed: false },
  });

  const [stage, setStage] = useState("grow");
  const [note, setNote] = useState("");

  if (!isLoaded) return <div data-testid="ltr-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = note.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: LifeTreeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      stage,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedStage = STAGES.find((s) => s.id === stage)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="ltr-title" className="text-xl font-bold text-amber-700 text-center">
        {config?.title ?? "生命之樹"}
      </h2>
      <p data-testid="ltr-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "此刻，你的生命正處於哪個階段？"}
      </p>
      <p data-testid="ltr-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ltr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉生命之樹
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="ltr-form" className="space-y-3 bg-amber-50 rounded-xl p-4">
          <div data-testid="ltr-stage-grid" className="grid grid-cols-2 gap-2">
            {STAGES.map((s) => (
              <button
                key={s.id}
                data-testid={`ltr-stage-${s.id}`}
                onClick={() => setStage(s.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-colors ${
                  stage === s.id
                    ? "bg-amber-100 border-amber-400"
                    : "bg-white border-gray-200 hover:border-amber-200"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-amber-700 font-medium mb-1">
              {selectedStage.icon} 為什麼是這個階段？
            </label>
            <textarea
              data-testid="ltr-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="說說你的生命故事..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <button
            data-testid="ltr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            種下我的樹
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ltr-my-entry" className="p-4 rounded-xl border-2 bg-amber-50 border-amber-300 space-y-1">
          <p className="text-sm font-medium text-amber-700">
            {STAGES.find((s) => s.id === myEntry.stage)?.icon}{" "}
            {STAGES.find((s) => s.id === myEntry.stage)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.note}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ltr-empty" className="text-center text-gray-400 py-8">還沒有人種下生命之樹</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ltr-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const stg = STAGES.find((s) => s.id === e.stage);
            return (
              <div
                key={e.entryId}
                data-testid={`ltr-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{stg?.icon} {stg?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
