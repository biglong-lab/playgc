import { useState } from "react";
import { Telescope, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface VisionEntry {
  entryId: string;
  userId: string;
  userName: string;
  keywords: string[];
  sentence: string;
  horizon: string;
}

interface VisionBoardState extends Record<string, unknown> {
  entries: VisionEntry[];
  revealed: boolean;
}

interface VisionBoardConfig {
  title: string;
  prompt: string;
  horizon: string;
}

function extractConfig(raw: Record<string, unknown>): VisionBoardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "願景板",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "用 3 個關鍵詞描繪你的願景，再寫一句話說明",
    horizon:
      typeof raw.horizon === "string" ? raw.horizon : "一年後",
  };
}

const DEFAULT_STATE: VisionBoardState = { entries: [], revealed: false };

const HORIZON_OPTIONS = ["3 個月後", "半年後", "一年後", "三年後", "五年後"];

const CARD_GRADIENTS = [
  "from-violet-400 to-purple-500",
  "from-teal-400 to-cyan-500",
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-blue-400 to-indigo-500",
  "from-green-400 to-emerald-500",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function VisionBoard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<VisionBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "vision_board",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [kw1, setKw1] = useState("");
  const [kw2, setKw2] = useState("");
  const [kw3, setKw3] = useState("");
  const [sentence, setSentence] = useState("");
  const [horizon, setHorizon] = useState(cfg.horizon);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="vb-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const keywords = [kw1.trim(), kw2.trim(), kw3.trim()].filter((k) => k.length >= 1);
  const canSubmit = keywords.length >= 2 && sentence.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: VisionEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      keywords,
      sentence: sentence.trim(),
      horizon,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Telescope className="w-5 h-5 text-violet-600" />
        <h2 className="text-xl font-bold" data-testid="vb-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="vb-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="vb-count">
        已提交：{state.entries.length} 份願景
      </p>

      {!myEntry ? (
        <div className="space-y-3" data-testid="vb-form">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">時間跨度</p>
            <div data-testid="vb-horizon-picker" className="flex flex-wrap gap-2">
              {HORIZON_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  data-testid={`vb-horizon-${opt}`}
                  onClick={() => setHorizon(opt)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    horizon === opt
                      ? "border-violet-500 bg-violet-50 text-violet-700 font-medium"
                      : "border-gray-200 text-gray-500 hover:border-violet-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">
              3 個關鍵詞（至少填 2 個）
            </p>
            <div className="flex gap-2" data-testid="vb-keywords">
              <input
                data-testid="vb-kw1"
                className="flex-1 border rounded p-2 text-sm"
                placeholder="關鍵詞 1"
                maxLength={10}
                value={kw1}
                onChange={(e) => setKw1(e.target.value)}
              />
              <input
                data-testid="vb-kw2"
                className="flex-1 border rounded p-2 text-sm"
                placeholder="關鍵詞 2"
                maxLength={10}
                value={kw2}
                onChange={(e) => setKw2(e.target.value)}
              />
              <input
                data-testid="vb-kw3"
                className="flex-1 border rounded p-2 text-sm"
                placeholder="關鍵詞 3"
                maxLength={10}
                value={kw3}
                onChange={(e) => setKw3(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              一句話描述你的願景（≥5字）
            </label>
            <textarea
              data-testid="vb-sentence-input"
              className="w-full border rounded p-2 text-sm resize-none"
              rows={2}
              placeholder={`${horizon}，我想要…`}
              maxLength={80}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
            />
          </div>

          <button
            data-testid="vb-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-violet-600 text-white rounded disabled:opacity-40 text-sm"
          >
            加入願景板
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-violet-50 rounded border border-violet-200 text-sm"
          data-testid="vb-my-entry"
        >
          <p className="text-xs text-violet-700 font-medium mb-1">
            你的願景（{myEntry.horizon}）
          </p>
          <div className="flex gap-1 mb-1 flex-wrap">
            {myEntry.keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-600 italic">「{myEntry.sentence}」</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="vb-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示願景板
        </button>
      )}

      {state.revealed && (
        <div data-testid="vb-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🔭 全隊願景板</p>
          {state.entries.length === 0 ? (
            <p data-testid="vb-empty" className="text-gray-400 text-sm">尚無提交</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {state.entries.map((entry, idx) => (
                <div
                  key={entry.entryId}
                  data-testid={`vb-card-${entry.entryId}`}
                  className={`p-3 rounded-lg bg-gradient-to-br ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]} text-white`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-90">
                    {entry.userName} · {entry.horizon}
                  </p>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {entry.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs italic opacity-90">「{entry.sentence}」</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VisionBoard;
