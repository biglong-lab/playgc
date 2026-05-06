import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface StarEntry {
  entryId: string;
  userId: string;
  userName: string;
  starType: string;
  dream: string;
}

interface NightSkyState extends Record<string, unknown> {
  entries: StarEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: NightSkyState = { entries: [], revealed: false };

const STAR_TYPES = [
  { id: "shooting", label: "流星", icon: "🌠", desc: "短暫璀璨，全力燃燒" },
  { id: "north", label: "北極星", icon: "⭐", desc: "穩定指引，永恆方向" },
  { id: "twin", label: "雙星", icon: "✨", desc: "相互輝映，共同成長" },
  { id: "supernova", label: "超新星", icon: "💥", desc: "爆發力量，照亮四周" },
  { id: "satellite", label: "衛星", icon: "🛸", desc: "繞行守護，默默付出" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function NightSky({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<NightSkyState>({
    gameId,
    sessionId,
    pageId,
    type: "night_sky",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedStar, setSelectedStar] = useState("shooting");
  const [dream, setDream] = useState("");

  if (!isLoaded) return <div data-testid="nsk-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "夜空星願";
  const prompt = config?.prompt ?? "你是夜空中的哪種星？把你的夢想寄託在星光裡";
  const entries = (state.entries ?? []) as StarEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = dream.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: StarEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      starType: selectedStar,
      dream: dream.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setDream("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="nsk-title" className="text-xl font-bold text-center text-blue-900">{title}</h2>
      <p data-testid="nsk-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="nsk-count" className="text-center text-xs text-gray-400">已許願：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="nsk-form" className="space-y-3">
          <div data-testid="nsk-star-grid" className="grid grid-cols-1 gap-2">
            {STAR_TYPES.map((s) => (
              <button
                key={s.id}
                data-testid={`nsk-star-${s.id}`}
                onClick={() => setSelectedStar(s.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedStar === s.id ? "bg-blue-100 border-blue-400" : "bg-white border-gray-200"}`}
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
            data-testid="nsk-dream-input"
            value={dream}
            onChange={(e) => setDream(e.target.value)}
            placeholder="許下你的星願或夢想（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            data-testid="nsk-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-blue-700 text-white font-medium disabled:opacity-40"
          >
            點亮星願
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="nsk-my-entry" className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-700">我的星願已點亮</p>
          <p className="text-xs text-gray-500 mt-1">{STAR_TYPES.find((s) => s.id === myEntry.starType)?.label} — {myEntry.dream}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="nsk-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          點亮夜空
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="nsk-empty" className="text-center text-gray-400 py-8">夜空還沒有星光</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="nsk-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`nsk-card-${e.entryId}`} className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{STAR_TYPES.find((s) => s.id === e.starType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{STAR_TYPES.find((s) => s.id === e.starType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.dream}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
