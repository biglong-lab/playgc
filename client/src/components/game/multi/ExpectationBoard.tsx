import { useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ExpectEntry {
  entryId: string;
  userId: string;
  userName: string;
  expectation: string;
  contribution: string;
}

interface ExpectationBoardState extends Record<string, unknown> {
  entries: ExpectEntry[];
  revealed: boolean;
}

interface ExpectationBoardConfig {
  title: string;
  expectLabel: string;
  contributeLabel: string;
  expectPlaceholder: string;
  contributePlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): ExpectationBoardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "期望看板",
    expectLabel:
      typeof raw.expectLabel === "string" ? raw.expectLabel : "🎯 我對這次活動的期望",
    contributeLabel:
      typeof raw.contributeLabel === "string"
        ? raw.contributeLabel
        : "🤝 我可以貢獻的是",
    expectPlaceholder:
      typeof raw.expectPlaceholder === "string"
        ? raw.expectPlaceholder
        : "我希望這次能夠...",
    contributePlaceholder:
      typeof raw.contributePlaceholder === "string"
        ? raw.contributePlaceholder
        : "我可以帶來...",
  };
}

const EXPECT_COLORS = [
  "bg-sky-50 border-sky-200",
  "bg-violet-50 border-violet-200",
  "bg-emerald-50 border-emerald-200",
  "bg-rose-50 border-rose-200",
  "bg-amber-50 border-amber-200",
];

const DEFAULT_STATE: ExpectationBoardState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ExpectationBoard({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ExpectationBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "expectation_board",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [expectation, setExpectation] = useState("");
  const [contribution, setContribution] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="eb-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = expectation.trim().length > 0 || contribution.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: ExpectEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      expectation: expectation.trim(),
      contribution: contribution.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function colorFor(i: number) {
    return EXPECT_COLORS[i % EXPECT_COLORS.length];
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-sky-600" />
        <h2 className="text-xl font-bold" data-testid="eb-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-xs text-gray-400" data-testid="eb-count">
        已填寫：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-3">
          <div>
            <label
              className="text-xs font-semibold text-sky-700 block mb-1"
              data-testid="eb-expect-label"
            >
              {cfg.expectLabel}
            </label>
            <textarea
              data-testid="eb-expect-input"
              className="w-full border border-sky-200 rounded p-2 text-sm resize-none h-16"
              placeholder={cfg.expectPlaceholder}
              maxLength={100}
              value={expectation}
              onChange={(e) => setExpectation(e.target.value)}
            />
          </div>
          <div>
            <label
              className="text-xs font-semibold text-emerald-700 block mb-1"
              data-testid="eb-contribute-label"
            >
              {cfg.contributeLabel}
            </label>
            <textarea
              data-testid="eb-contribute-input"
              className="w-full border border-emerald-200 rounded p-2 text-sm resize-none h-16"
              placeholder={cfg.contributePlaceholder}
              maxLength={100}
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </div>
          <button
            data-testid="eb-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-600 text-white rounded disabled:opacity-40 text-sm"
          >
            送出期望
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-sky-50 rounded border border-sky-200 text-sm space-y-1"
          data-testid="eb-my-entry"
        >
          {myEntry.expectation && (
            <p>
              <span className="text-sky-700 font-medium text-xs">🎯</span>{" "}
              {myEntry.expectation}
            </p>
          )}
          {myEntry.contribution && (
            <p>
              <span className="text-emerald-700 font-medium text-xs">🤝</span>{" "}
              {myEntry.contribution}
            </p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="eb-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊期望
        </button>
      )}

      {state.revealed && (
        <div data-testid="eb-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🎯 全隊期望看板</p>
          {state.entries.length === 0 ? (
            <p data-testid="eb-empty" className="text-gray-400 text-sm">
              尚無資料
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`eb-card-${entry.entryId}`}
                  className={`rounded-lg border p-3 text-sm space-y-1.5 ${colorFor(i)}`}
                >
                  <p className="text-xs font-semibold text-gray-500">{entry.userName}</p>
                  {entry.expectation && (
                    <p className="text-xs text-gray-700">
                      <span className="text-sky-600">🎯</span> {entry.expectation}
                    </p>
                  )}
                  {entry.contribution && (
                    <p className="text-xs text-gray-700">
                      <span className="text-emerald-600">🤝</span> {entry.contribution}
                    </p>
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

export default ExpectationBoard;
