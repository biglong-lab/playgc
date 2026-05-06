import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface CloudEntry {
  entryId: string;
  userId: string;
  userName: string;
  cloudType: string;
  thought: string;
}

interface CloudDriftState extends Record<string, unknown> {
  entries: CloudEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: CloudDriftState = { entries: [], revealed: false };

const CLOUD_TYPES = [
  { id: "cumulus", label: "積雲", icon: "⛅", desc: "飽滿蓬鬆，充滿想像" },
  { id: "cirrus", label: "卷雲", icon: "🌤️", desc: "輕盈飄逸，悠然自在" },
  { id: "thunder", label: "雷雲", icon: "⛈️", desc: "蓄勢待發，能量充足" },
  { id: "sunset", label: "晚霞雲", icon: "🌅", desc: "金光璀璨，溫柔收尾" },
  { id: "rainbow", label: "彩雲", icon: "🌈", desc: "色彩繽紛，充滿希望" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function CloudDrift({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<CloudDriftState>({
    gameId,
    sessionId,
    pageId,
    type: "cloud_drift",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedCloud, setSelectedCloud] = useState("cumulus");
  const [thought, setThought] = useState("");

  if (!isLoaded) return <div data-testid="cld-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "雲朵漂移";
  const prompt = config?.prompt ?? "你的思緒像哪朵雲？";
  const entries = (state.entries ?? []) as CloudEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = thought.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: CloudEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      cloudType: selectedCloud,
      thought: thought.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setThought("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="cld-title" className="text-xl font-bold text-center text-sky-800">{title}</h2>
      <p data-testid="cld-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="cld-count" className="text-center text-xs text-gray-400">已飄過：{entries.length} 朵雲</p>

      {!myEntry && !revealed && (
        <div data-testid="cld-form" className="space-y-3">
          <div data-testid="cld-cloud-grid" className="grid grid-cols-1 gap-2">
            {CLOUD_TYPES.map((c) => (
              <button
                key={c.id}
                data-testid={`cld-cloud-${c.id}`}
                onClick={() => setSelectedCloud(c.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${selectedCloud === c.id ? "bg-sky-100 border-sky-500" : "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="font-medium text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cld-thought-input"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="說說你的思緒在哪裡漂（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            data-testid="cld-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-sky-600 text-white font-medium disabled:opacity-40"
          >
            放飛雲朵
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="cld-my-entry" className="bg-sky-50 border border-sky-200 rounded-lg p-3">
          <p className="text-sm font-medium text-sky-700">我的雲朵已飄出</p>
          <p className="text-xs text-gray-500 mt-1">{CLOUD_TYPES.find((c) => c.id === myEntry.cloudType)?.label} — {myEntry.thought}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cld-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          展開天空
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cld-empty" className="text-center text-gray-400 py-8">天空還是一片晴空萬里</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cld-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`cld-card-${e.entryId}`} className="bg-white border border-sky-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CLOUD_TYPES.find((c) => c.id === e.cloudType)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">{CLOUD_TYPES.find((c) => c.id === e.cloudType)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.thought}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
