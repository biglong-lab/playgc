import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface KoiPondEntry {
  entryId: string;
  userId: string;
  userName: string;
  koiColor: string;
  reflection: string;
}

interface KoiPondState extends Record<string, unknown> {
  entries: KoiPondEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: KoiPondState = { entries: [], revealed: false };

const KOI_COLORS = [
  { id: "red_koi", label: "紅錦鯉", icon: "🐠", desc: "好運連連，吉祥如意" },
  { id: "gold_koi", label: "金錦鯉", icon: "🌟", desc: "財源廣進，富貴吉祥" },
  { id: "black_koi", label: "黑錦鯉", icon: "🖤", desc: "深邃智慧，化解逆境" },
  { id: "white_koi", label: "白錦鯉", icon: "🤍", desc: "純潔無瑕，心靈清澈" },
  { id: "blue_koi", label: "藍錦鯉", icon: "💙", desc: "寧靜致遠，平和自在" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function KoiPond({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<KoiPondState>({
    gameId,
    sessionId,
    pageId,
    type: "koi_pond",
    defaultState: DEFAULT_STATE,
  });

  const [selectedKoi, setSelectedKoi] = useState("red_koi");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="koi-loading">載入中...</div>;

  const title = config?.title ?? "錦鯉許願池";
  const prompt = config?.prompt ?? "選一條錦鯉，讓它帶走你的心願游向遠方";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: KoiPondEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      koiColor: selectedKoi,
      reflection: reflection.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setReflection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="koi-title" className="text-2xl font-bold text-cyan-700">
        {title}
      </h2>
      <p data-testid="koi-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="koi-count" className="text-sm text-gray-500">
        已許願 {state.entries.length} 條錦鯉
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="koi-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {KOI_COLORS.map((kc) => (
              <button
                key={kc.id}
                data-testid={`koi-color-${kc.id}`}
                onClick={() => setSelectedKoi(kc.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedKoi === kc.id
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                    : "border-gray-200 hover:border-cyan-300"
                }`}
              >
                <div className="text-xl">{kc.icon}</div>
                <div className="text-xs font-medium">{kc.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{kc.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="koi-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="寫下你的心願與感悟..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-cyan-400 focus:outline-none"
          />
          <button
            data-testid="koi-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-cyan-500 text-white font-semibold disabled:opacity-40"
          >
            放入許願池 🐠
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="koi-my-entry" className="p-4 bg-cyan-50 rounded-xl border border-cyan-200 space-y-1">
          <p className="text-sm text-cyan-600 font-medium">
            {KOI_COLORS.find((k) => k.id === myEntry.koiColor)?.icon}{" "}
            {KOI_COLORS.find((k) => k.id === myEntry.koiColor)?.label}
          </p>
          <p className="text-gray-700">{myEntry.reflection}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="koi-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-teal-600 text-white font-semibold"
        >
          揭曉所有心願 🐠
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="koi-empty" className="text-center text-gray-400 py-8">
          許願池中尚無錦鯉
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="koi-result" className="space-y-3">
          <h3 className="font-semibold text-cyan-700">所有心願已揭曉</h3>
          {state.entries.map((entry) => {
            const kc = KOI_COLORS.find((k) => k.id === entry.koiColor);
            return (
              <div
                key={entry.entryId}
                data-testid={`koi-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-cyan-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{kc?.icon}</span>
                  <span className="font-medium text-cyan-700">{kc?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.reflection}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
