export interface MoodRating extends Record<string, unknown> {
  ratingId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface GroupMoodConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  minLabel: string;
  maxLabel: string;
}

export interface GroupMoodState extends Record<string, unknown> {
  ratings: MoodRating[];
  revealed: boolean;
}

const DEFAULT_CONFIG: GroupMoodConfig = {
  title: "團隊能量儀表",
  prompt: "現在你的能量/心情如何？",
  minLabel: "很低落",
  maxLabel: "超亢奮",
};

interface Props {
  config: GroupMoodConfig;
  state: GroupMoodState;
  myUserId: string;
  onSubmit: (value: number) => void;
  onReveal: () => void;
}

export default function GroupMood({ config, state, myUserId, onSubmit, onReveal }: Props) {
  const { title, prompt, minLabel, maxLabel } = config || DEFAULT_CONFIG;
  const { ratings, revealed } = state;

  const myRating = ratings.find((r) => r.userId === myUserId);

  const avg =
    ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + r.value, 0) / ratings.length) * 10) / 10
      : null;

  function countForValue(v: number) {
    return ratings.filter((r) => r.value === v).length;
  }

  const maxCount = Math.max(...Array.from({ length: 10 }, (_, i) => countForValue(i + 1)), 1);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="gm-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="gm-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myRating ? (
            <>
              <div className="flex justify-between text-xs text-gray-400 px-1">
                <span>{minLabel}</span>
                <span>{maxLabel}</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                  <button
                    key={v}
                    data-testid={`gm-btn-${v}`}
                    onClick={() => onSubmit(v)}
                    className="py-3 rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-700 font-bold text-sm transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p data-testid="gm-submitted" className="text-center text-sm text-gray-500">
              ✅ 已回答：{myRating.value} / 10
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="gm-count">{ratings.length}</span> 人回答
          </p>

          <div className="text-center">
            <button
              data-testid="gm-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布結果
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="gm-result" className="space-y-3">
          {ratings.length === 0 ? (
            <div data-testid="gm-empty" className="text-center text-gray-400 py-8">
              尚無人回答
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
                  const count = countForValue(v);
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-4 text-right">{v}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          data-testid={`gm-bar-${v}`}
                          className="h-5 bg-blue-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
              <p
                data-testid="gm-avg"
                className="text-center text-sm font-semibold text-blue-600"
              >
                平均能量：{avg} / 10
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
