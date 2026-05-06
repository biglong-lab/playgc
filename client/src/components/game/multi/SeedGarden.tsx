import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface SeedEntry {
  entryId: string;
  userId: string;
  userName: string;
  seedType: string;
  intention: string;
}

interface SeedGardenState extends Record<string, unknown> {
  entries: SeedEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SeedGardenState = { entries: [], revealed: false };

const SEED_TYPES = [
  { id: "sunflower", label: "向日葵", icon: "🌻", desc: "追逐光明，永遠向上" },
  { id: "dandelion", label: "蒲公英", icon: "🌼", desc: "隨風播種，處處生根" },
  { id: "bamboo", label: "竹子", icon: "🎋", desc: "韌性生長，節節高升" },
  { id: "oak", label: "橡樹", icon: "🌳", desc: "深根厚植，穩定長遠" },
  { id: "lotus", label: "蓮花", icon: "🪷", desc: "出淤泥而不染，靜靜綻放" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SeedGarden({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SeedGardenState>({
    gameId,
    sessionId,
    pageId,
    type: "seed_garden",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedSeed, setSelectedSeed] = useState("sunflower");
  const [intention, setIntention] = useState("");

  if (!isLoaded) return <div data-testid="sdg-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "種子花園";
  const prompt = config?.prompt ?? "你想在心中種下哪種種子？";
  const entries = (state.entries ?? []) as SeedEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = intention.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: SeedEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      seedType: selectedSeed,
      intention: intention.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setIntention("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="sdg-title" className="text-xl font-bold text-center text-emerald-800">{title}</h2>
      <p data-testid="sdg-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="sdg-count" className="text-center text-xs text-gray-400">已種下：{entries.length} 顆種子</p>

      {!myEntry && !revealed && (
        <div data-testid="sdg-form" className="space-y-3">
          <div data-testid="sdg-seed-grid" className="grid grid-cols-1 gap-2">
            {SEED_TYPES.map((s) => (
              <button
                key={s.id}
                data-testid={`sdg-seed-${s.id}`}
                onClick={() => setSelectedSeed(s.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedSeed === s.id ? "bg-emerald-100 border-emerald-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sdg-intention-input"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="說說你種下這顆種子的意圖（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            data-testid="sdg-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-40"
          >
            種下種子
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="sdg-my-entry" className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-sm font-medium text-emerald-700">我的種子已種下</p>
          <p className="text-xs text-gray-500 mt-1">{SEED_TYPES.find((s) => s.id === myEntry.seedType)?.label} — {myEntry.intention}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sdg-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展示花園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sdg-empty" className="text-center text-gray-400 py-8">花園裡還沒有種子</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sdg-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`sdg-card-${e.entryId}`} className="bg-white border border-emerald-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{SEED_TYPES.find((s) => s.id === e.seedType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{SEED_TYPES.find((s) => s.id === e.seedType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.intention}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
