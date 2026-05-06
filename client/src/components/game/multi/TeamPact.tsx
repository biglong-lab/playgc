import { useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PactRule {
  entryId: string;
  userId: string;
  userName: string;
  rule: string;
  category: string;
}

interface TeamPactState extends Record<string, unknown> {
  rules: PactRule[];
  revealed: boolean;
  pactTitle: string;
}

interface TeamPactConfig {
  title: string;
  prompt: string;
  pactTitle: string;
}

function extractConfig(raw: Record<string, unknown>): TeamPactConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "隊伍公約",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "為我們的隊伍提出一條共同遵守的規則或精神",
    pactTitle:
      typeof raw.pactTitle === "string" ? raw.pactTitle : "我們的公約",
  };
}

const DEFAULT_STATE: TeamPactState = {
  rules: [],
  revealed: false,
  pactTitle: "我們的公約",
};

const CATEGORIES = [
  { id: "communication", label: "溝通" },
  { id: "respect", label: "尊重" },
  { id: "collaboration", label: "協作" },
  { id: "accountability", label: "責任" },
  { id: "growth", label: "成長" },
  { id: "fun", label: "樂趣" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  communication: "bg-blue-100 text-blue-700 border-blue-300",
  respect: "bg-purple-100 text-purple-700 border-purple-300",
  collaboration: "bg-green-100 text-green-700 border-green-300",
  accountability: "bg-orange-100 text-orange-700 border-orange-300",
  growth: "bg-teal-100 text-teal-700 border-teal-300",
  fun: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamPact({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamPactState>({
    gameId,
    sessionId,
    pageId,
    type: "team_pact",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [rule, setRule] = useState("");
  const [category, setCategory] = useState<string>("communication");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tp-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myRule = state.rules.find((r) => r.userId === userId);
  const canSubmit = rule.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: PactRule = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      rule: rule.trim(),
      category,
    };
    updateState({
      ...state,
      rules: [...state.rules, entry],
      pactTitle: cfg.pactTitle,
    });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileCheck className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-bold" data-testid="tp-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tp-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="tp-count">
        已提交：{state.rules.length} 條規則
      </p>

      {!myRule ? (
        <div className="space-y-3" data-testid="tp-form">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">類別</p>
            <div data-testid="tp-categories" className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  data-testid={`tp-cat-${cat.id}`}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded border transition-all ${
                    category === cat.id
                      ? CATEGORY_COLORS[cat.id] + " font-semibold"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="tp-rule-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder="我們的公約：（≥5字）"
            maxLength={80}
            value={rule}
            onChange={(e) => setRule(e.target.value)}
          />

          <button
            data-testid="tp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-40 text-sm"
          >
            加入公約
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-emerald-50 rounded border border-emerald-200 text-sm"
          data-testid="tp-my-entry"
        >
          <p className="text-xs text-emerald-700 font-medium mb-1">你提出的規則</p>
          <p className="text-xs text-gray-600">{myRule.rule}</p>
          <span className={`mt-1 inline-block px-1.5 py-0.5 text-xs rounded border ${CATEGORY_COLORS[myRule.category] ?? ""}`}>
            {CATEGORIES.find((c) => c.id === myRule.category)?.label}
          </span>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tp-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示隊伍公約
        </button>
      )}

      {state.revealed && (
        <div data-testid="tp-result" className="space-y-3">
          <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
            <p className="text-sm font-bold text-emerald-800 mb-3 text-center">
              📜 {state.pactTitle || cfg.pactTitle}
            </p>
            {state.rules.length === 0 ? (
              <p data-testid="tp-empty" className="text-gray-400 text-sm text-center">
                尚無規則
              </p>
            ) : (
              <div className="space-y-2">
                {state.rules.map((r, idx) => (
                  <div
                    key={r.entryId}
                    data-testid={`tp-card-${r.entryId}`}
                    className="flex gap-2 items-start"
                  >
                    <span className="text-emerald-600 font-bold text-sm w-5 flex-shrink-0">
                      {idx + 1}.
                    </span>
                    <div>
                      <p className="text-xs text-gray-700">{r.rule}</p>
                      <p className="text-xs text-gray-400">— {r.userName}</p>
                    </div>
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${CATEGORY_COLORS[r.category] ?? ""}`}>
                      {CATEGORIES.find((c) => c.id === r.category)?.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamPact;
