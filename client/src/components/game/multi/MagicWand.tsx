import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface WandEntry {
  entryId: string;
  userId: string;
  userName: string;
  domain: string;
  wish: string;
}

interface MagicWandState extends Record<string, unknown> {
  entries: WandEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: MagicWandState = { entries: [], revealed: false };

const DOMAINS = [
  { id: "team", label: "團隊關係", icon: "🤝" },
  { id: "process", label: "工作流程", icon: "⚙️" },
  { id: "culture", label: "組織文化", icon: "🌱" },
  { id: "tools", label: "工具資源", icon: "🛠️" },
  { id: "other", label: "其他", icon: "✨" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function MagicWand({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<MagicWandState>({
    gameId,
    sessionId,
    pageId,
    type: "magic_wand",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedDomain, setSelectedDomain] = useState("team");
  const [wish, setWish] = useState("");

  if (!isLoaded) return <div data-testid="mgw-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "魔法棒許願";
  const prompt = config?.prompt ?? "如果你有魔法棒，你想改變或創造什麼？";
  const entries = (state.entries ?? []) as WandEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = wish.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: WandEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      domain: selectedDomain,
      wish: wish.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setWish("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="mgw-title" className="text-xl font-bold text-center text-yellow-700">{title}</h2>
      <p data-testid="mgw-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="mgw-count" className="text-center text-xs text-gray-400">已許願：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="mgw-form" className="space-y-3">
          <div data-testid="mgw-domain-grid" className="flex flex-wrap gap-2">
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                data-testid={`mgw-domain-${d.id}`}
                onClick={() => setSelectedDomain(d.id)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${selectedDomain === d.id ? "bg-yellow-100 border-yellow-400" : "bg-white border-gray-200"}`}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>
          <textarea
            data-testid="mgw-wish-input"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="寫下你的魔法願望（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <button
            data-testid="mgw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-yellow-500 text-white font-medium disabled:opacity-40"
          >
            揮舞魔法棒
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="mgw-my-entry" className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-700">我的願望已送出</p>
          <p className="text-xs text-gray-500 mt-1">{DOMAINS.find((d) => d.id === myEntry.domain)?.label} — {myEntry.wish}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mgw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭曉所有願望
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mgw-empty" className="text-center text-gray-400 py-8">還沒有人許願</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mgw-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`mgw-card-${e.entryId}`} className="bg-white border border-yellow-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{DOMAINS.find((d) => d.id === e.domain)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">{DOMAINS.find((d) => d.id === e.domain)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.wish}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
