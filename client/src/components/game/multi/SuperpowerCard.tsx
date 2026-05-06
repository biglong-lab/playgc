import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PowerEntry {
  entryId: string;
  userId: string;
  userName: string;
  superpower: string;
  kryptonite: string;
  origin: string;
}

interface SuperpowerCardState extends Record<string, unknown> {
  entries: PowerEntry[];
  revealed: boolean;
}

interface SuperpowerCardConfig {
  title: string;
  prompt: string;
  superpowerLabel: string;
  kryptoniteLabel: string;
  originLabel: string;
  suggestions: string[];
}

const DEFAULT_SUGGESTIONS = [
  "快速學習", "化繁為簡", "跨界整合", "同理傾聽", "危機處理",
  "說故事", "數據洞察", "創意發想", "推動執行", "凝聚共識",
  "細節把關", "大局思維", "帶動氣氛", "問對問題", "持續改善",
];

function extractConfig(raw: Record<string, unknown>): SuperpowerCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "超能力卡片",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "如果你是一位超級英雄，你的超能力是什麼？",
    superpowerLabel:
      typeof raw.superpowerLabel === "string" ? raw.superpowerLabel : "我的超能力",
    kryptoniteLabel:
      typeof raw.kryptoniteLabel === "string" ? raw.kryptoniteLabel : "我的弱點（氪星石）",
    originLabel:
      typeof raw.originLabel === "string" ? raw.originLabel : "這個能力如何得來的？（選填）",
    suggestions: Array.isArray(raw.suggestions)
      ? (raw.suggestions as string[])
      : DEFAULT_SUGGESTIONS,
  };
}

const DEFAULT_STATE: SuperpowerCardState = { entries: [], revealed: false };

const CARD_COLORS = [
  "from-blue-400 to-indigo-500",
  "from-purple-400 to-pink-500",
  "from-orange-400 to-red-500",
  "from-teal-400 to-green-500",
  "from-yellow-400 to-orange-500",
  "from-pink-400 to-rose-500",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SuperpowerCard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SuperpowerCardState>({
    gameId,
    sessionId,
    pageId,
    type: "superpower_card",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [superpower, setSuperpower] = useState("");
  const [customPower, setCustomPower] = useState("");
  const [kryptonite, setKryptonite] = useState("");
  const [origin, setOrigin] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="sp-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const finalPower = superpower || customPower.trim();
  const canSubmit = finalPower.length > 0 && kryptonite.trim().length >= 2;

  function selectPower(s: string) {
    setSuperpower((prev) => (prev === s ? "" : s));
    setCustomPower("");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: PowerEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      superpower: finalPower,
      kryptonite: kryptonite.trim(),
      origin: origin.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-bold" data-testid="sp-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="sp-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="sp-count">
        已建立：{state.entries.length} 張
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="sp-form">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2" data-testid="sp-power-label">
              ⚡ {cfg.superpowerLabel}
            </p>
            <div className="flex flex-wrap gap-2 mb-2" data-testid="sp-suggestions">
              {cfg.suggestions.map((s) => (
                <button
                  key={s}
                  data-testid={`sp-suggest-${s}`}
                  onClick={() => selectPower(s)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    superpower === s
                      ? "bg-yellow-400 text-white font-semibold"
                      : "bg-gray-100 text-gray-600 hover:bg-yellow-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              data-testid="sp-custom-input"
              className="w-full border rounded p-2 text-sm"
              placeholder="或自行填寫超能力…"
              maxLength={20}
              value={customPower}
              onChange={(e) => {
                setCustomPower(e.target.value);
                setSuperpower("");
              }}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1" data-testid="sp-kryptonite-label">
              💀 {cfg.kryptoniteLabel}
            </p>
            <input
              data-testid="sp-kryptonite-input"
              className="w-full border rounded p-2 text-sm"
              placeholder="讓你特別弱的事情（≥2字）"
              maxLength={30}
              value={kryptonite}
              onChange={(e) => setKryptonite(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1" data-testid="sp-origin-label">
              📖 {cfg.originLabel}
            </p>
            <input
              data-testid="sp-origin-input"
              className="w-full border rounded p-2 text-sm"
              placeholder="這個超能力的起源故事…（選填）"
              maxLength={60}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>

          <button
            data-testid="sp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-yellow-500 text-white rounded disabled:opacity-40 text-sm font-semibold"
          >
            建立英雄卡片
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm space-y-1"
          data-testid="sp-my-entry"
        >
          <p className="font-bold text-yellow-700">⚡ {myEntry.superpower}</p>
          <p className="text-xs text-gray-500">💀 弱點：{myEntry.kryptonite}</p>
          {myEntry.origin && (
            <p className="text-xs text-gray-400 italic">「{myEntry.origin}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sp-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示英雄卡片牆
        </button>
      )}

      {state.revealed && (
        <div data-testid="sp-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🦸 英雄卡片牆</p>
          {state.entries.length === 0 ? (
            <p data-testid="sp-empty" className="text-gray-400 text-sm">
              尚無卡片
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {state.entries.map((entry, idx) => (
                <div
                  key={entry.entryId}
                  data-testid={`sp-card-${entry.entryId}`}
                  className={`p-3 rounded-lg bg-gradient-to-r ${CARD_COLORS[idx % CARD_COLORS.length]} text-white`}
                >
                  <p className="text-xs font-medium opacity-80">{entry.userName}</p>
                  <p className="text-base font-bold mt-0.5">⚡ {entry.superpower}</p>
                  <p className="text-xs opacity-90 mt-1">💀 {entry.kryptonite}</p>
                  {entry.origin && (
                    <p className="text-xs opacity-75 italic mt-0.5">「{entry.origin}」</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SuperpowerCard;
