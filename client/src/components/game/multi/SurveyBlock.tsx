import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SurveyEntry {
  entryId: string;
  userId: string;
  userName: string;
  answers: Record<string, string>;
}

interface SurveyBlockState extends Record<string, unknown> {
  entries: SurveyEntry[];
  revealed: boolean;
}

interface SurveyBlockConfig {
  title: string;
  prompt: string;
  questions: string[];
  options: string[];
}

function extractConfig(raw: Record<string, unknown>): SurveyBlockConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "快速問卷",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "請回答以下問題",
    questions:
      Array.isArray(raw.questions) && raw.questions.length > 0
        ? (raw.questions as string[])
        : ["團隊合作效率如何？", "溝通順暢嗎？", "下次會改善什麼？"],
    options: Array.isArray(raw.options) ? (raw.options as string[]) : ["非常好", "還不錯", "有待改善"],
  };
}

const DEFAULT_STATE: SurveyBlockState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SurveyBlock({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SurveyBlockState>({
    gameId,
    sessionId,
    pageId,
    type: "survey_block",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="sb-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const allAnswered = cfg.questions.every((q) => answers[q]);

  function handleSubmit() {
    if (!allAnswered) return;
    const entry: SurveyEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      answers: { ...answers },
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function getStats(question: string) {
    const counts: Record<string, number> = {};
    cfg.options.forEach((o) => { counts[o] = 0; });
    state.entries.forEach((e) => {
      const a = e.answers[question];
      if (a && counts[a] !== undefined) counts[a]++;
    });
    return counts;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold" data-testid="sb-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="sb-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="sb-count">已回答：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="sb-form">
          {cfg.questions.map((q, qi) => (
            <div key={qi} className="space-y-2">
              <p className="text-sm font-medium" data-testid={`sb-question-${qi}`}>{q}</p>
              <div className="flex gap-2 flex-wrap">
                {cfg.options.map((opt) => (
                  <button
                    key={opt}
                    data-testid={`sb-option-${qi}-${opt}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q]: opt }))}
                    className={`px-3 py-1 rounded text-sm border transition-colors ${
                      answers[q] === opt
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            data-testid="sb-submit-btn"
            disabled={!allAnswered}
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出問卷
          </button>
        </div>
      ) : (
        <div className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm" data-testid="sb-my-entry">
          已完成問卷 ✓
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="sb-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="sb-result" className="space-y-4">
          {state.entries.length === 0 ? (
            <p data-testid="sb-empty" className="text-gray-400 text-sm">尚無回答</p>
          ) : (
            cfg.questions.map((q, qi) => {
              const stats = getStats(q);
              const total = Object.values(stats).reduce((a, b) => a + b, 0);
              return (
                <div key={qi} data-testid={`sb-stats-q-${qi}`} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">{q}</p>
                  {cfg.options.map((opt) => {
                    const pct = total > 0 ? Math.round((stats[opt] / total) * 100) : 0;
                    return (
                      <div key={opt} className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-600 w-16 truncate">{opt}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-400 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{stats[opt]}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default SurveyBlock;
