import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RatingDimension {
  id: string;
  label: string;
  emoji: string;
}

interface RatingEntry {
  entryId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
  feedback: string;
}

interface MeetingRatingState extends Record<string, unknown> {
  entries: RatingEntry[];
  revealed: boolean;
}

interface MeetingRatingConfig {
  title: string;
  meetingName: string;
  dimensions: RatingDimension[];
  feedbackPlaceholder: string;
}

const DEFAULT_DIMS: RatingDimension[] = [
  { id: "useful", label: "這次會議有價值", emoji: "💡" },
  { id: "focused", label: "討論保持聚焦", emoji: "🎯" },
  { id: "implement", label: "我會落實結論", emoji: "🚀" },
  { id: "time", label: "時間運用得當", emoji: "⏱️" },
];

function extractConfig(raw: Record<string, unknown>): MeetingRatingConfig {
  const dims = Array.isArray(raw.dimensions)
    ? (raw.dimensions as RatingDimension[])
    : DEFAULT_DIMS;
  return {
    title: typeof raw.title === "string" ? raw.title : "會議評分",
    meetingName: typeof raw.meetingName === "string" ? raw.meetingName : "這次會議",
    dimensions: dims,
    feedbackPlaceholder:
      typeof raw.feedbackPlaceholder === "string"
        ? raw.feedbackPlaceholder
        : "有什麼想補充的嗎？（選填）",
  };
}

const SCORE_EMOJI = ["", "😞", "😕", "😐", "😊", "🤩"];

const DEFAULT_STATE: MeetingRatingState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MeetingRating({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<MeetingRatingState>({
    gameId,
    sessionId,
    pageId,
    type: "meeting_rating",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(cfg.dimensions.map((d) => [d.id, 0]))
  );
  const [feedback, setFeedback] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="mr-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = cfg.dimensions.every((d) => (scores[d.id] ?? 0) > 0);

  function handleScore(dimId: string, val: number) {
    setScores((prev) => ({ ...prev, [dimId]: val }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: RatingEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      scores: { ...scores },
      feedback: feedback.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function avgFor(dimId: string) {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce(
      (s, e) => s + ((e.scores[dimId] as number) ?? 0),
      0
    );
    return sum / state.entries.length;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-bold" data-testid="mr-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-500" data-testid="mr-meeting-name">
        {cfg.meetingName}
      </p>
      <p className="text-xs text-gray-400" data-testid="mr-count">
        已評分：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="mr-form">
          {cfg.dimensions.map((dim) => (
            <div key={dim.id}>
              <p className="text-sm font-medium text-gray-700 mb-2" data-testid={`mr-dim-${dim.id}`}>
                {dim.emoji} {dim.label}
              </p>
              <div className="flex gap-2 items-center">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    data-testid={`mr-score-${dim.id}-${v}`}
                    onClick={() => handleScore(dim.id, v)}
                    title={SCORE_EMOJI[v]}
                    className={`w-10 h-10 rounded-full text-lg transition-all ${
                      scores[dim.id] === v
                        ? "bg-teal-600 text-white shadow-md scale-110"
                        : "bg-gray-100 hover:bg-teal-100 text-gray-600"
                    }`}
                  >
                    {SCORE_EMOJI[v]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <input
            data-testid="mr-feedback-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.feedbackPlaceholder}
            maxLength={100}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button
            data-testid="mr-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-teal-600 text-white rounded disabled:opacity-40 text-sm"
          >
            送出評分
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-teal-50 rounded border border-teal-200 text-sm space-y-1"
          data-testid="mr-my-entry"
        >
          {cfg.dimensions.map((d) => (
            <p key={d.id} className="text-xs text-gray-600">
              {d.emoji} {d.label}：{SCORE_EMOJI[myEntry.scores[d.id] ?? 0]}
            </p>
          ))}
          {myEntry.feedback && (
            <p className="text-xs text-gray-500 italic mt-1">「{myEntry.feedback}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="mr-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊評分
        </button>
      )}

      {state.revealed && (
        <div data-testid="mr-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📊 會議評分結果</p>
          {state.entries.length === 0 ? (
            <p data-testid="mr-empty" className="text-gray-400 text-sm">
              尚無評分
            </p>
          ) : (
            <div className="space-y-2">
              {cfg.dimensions.map((dim) => {
                const avg = avgFor(dim.id);
                const pct = Math.round((avg / 5) * 100);
                return (
                  <div key={dim.id} data-testid={`mr-bar-${dim.id}`}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>
                        {dim.emoji} {dim.label}
                      </span>
                      <span className="font-medium">{avg.toFixed(1)}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {state.entries.filter((e) => e.feedback).map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`mr-card-${entry.entryId}`}
                  className="text-xs text-gray-600 bg-gray-50 rounded p-2 border"
                >
                  <span className="font-medium">{entry.userName}</span>：{entry.feedback}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MeetingRating;
