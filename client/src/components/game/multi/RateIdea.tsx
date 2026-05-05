export interface IdeaItem extends Record<string, unknown> {
  ideaId: string;
  text: string;
}

export interface IdeaRating extends Record<string, unknown> {
  ratingId: string;
  userId: string;
  userName: string;
  ideaId: string;
  score: number;
}

export interface RateIdeaConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  ideas: IdeaItem[];
}

export interface RateIdeaState extends Record<string, unknown> {
  ratings: IdeaRating[];
  revealed: boolean;
}

const DEFAULT_CONFIG: RateIdeaConfig = {
  title: "想法評分",
  prompt: "為每個想法評分（1-5 星）",
  ideas: [],
};

function avgScore(ratings: IdeaRating[], ideaId: string): number {
  const forIdea = ratings.filter((r) => r.ideaId === ideaId);
  if (forIdea.length === 0) return 0;
  return forIdea.reduce((s, r) => s + r.score, 0) / forIdea.length;
}

interface Props {
  config: RateIdeaConfig;
  state: RateIdeaState;
  myUserId: string;
  onRate: (ideaId: string, score: number) => void;
  onReveal: () => void;
}

export default function RateIdea({ config, state, myUserId, onRate, onReveal }: Props) {
  const { title, prompt, ideas } = config || DEFAULT_CONFIG;
  const { ratings, revealed } = state;

  const myRatings = ratings.filter((r) => r.userId === myUserId);
  const ratedCount = new Set(myRatings.map((r) => r.ideaId)).size;
  const totalIdeas = ideas.length;
  const allRated = ratedCount >= totalIdeas && totalIdeas > 0;

  const sortedIdeas = revealed
    ? [...ideas].sort((a, b) => avgScore(ratings, b.ideaId) - avgScore(ratings, a.ideaId))
    : ideas;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="ri-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="ri-prompt" className="text-sm text-center text-gray-600">
        {prompt}
      </p>

      {!revealed && (
        <>
          <p className="text-xs text-center text-gray-400">
            已評 <span data-testid="ri-rated-count">{ratedCount}</span> / {totalIdeas}
          </p>

          {ideas.length === 0 ? (
            <div data-testid="ri-empty" className="text-center text-gray-400 py-8">
              尚無想法可評分
            </div>
          ) : (
            <div className="space-y-3">
              {ideas.map((idea) => {
                const myRating = myRatings.find((r) => r.ideaId === idea.ideaId);
                return (
                  <div
                    key={idea.ideaId}
                    data-testid={`ri-idea-${idea.ideaId}`}
                    className="p-3 bg-white border border-gray-200 rounded-xl space-y-2"
                  >
                    <p className="text-sm font-medium text-gray-800">{idea.text}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          data-testid={`ri-star-${idea.ideaId}-${star}`}
                          onClick={() => onRate(idea.ideaId, star)}
                          className={`text-xl transition-all ${
                            myRating && myRating.score >= star
                              ? "text-amber-400"
                              : "text-gray-300 hover:text-amber-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      {myRating && (
                        <span
                          data-testid={`ri-my-score-${idea.ideaId}`}
                          className="text-xs text-amber-600 ml-1 self-center"
                        >
                          {myRating.score} 星
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center">
            <button
              data-testid="ri-reveal-btn"
              onClick={onReveal}
              disabled={!allRated}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-40"
            >
              公布評分結果
            </button>
          </div>
        </>
      )}

      {revealed && (
        <div data-testid="ri-result" className="space-y-3">
          {ideas.length === 0 ? (
            <div data-testid="ri-result-empty" className="text-center text-gray-400 py-8">
              尚無想法
            </div>
          ) : (
            sortedIdeas.map((idea, idx) => {
              const avg = avgScore(ratings, idea.ideaId);
              const ratingCount = ratings.filter((r) => r.ideaId === idea.ideaId).length;
              const pct = Math.round((avg / 5) * 100);
              return (
                <div
                  key={idea.ideaId}
                  data-testid={`ri-result-${idea.ideaId}`}
                  className="p-3 bg-white border border-gray-200 rounded-xl space-y-2"
                >
                  <div className="flex items-start gap-2">
                    {idx === 0 && <span className="text-amber-500 font-bold">🏆</span>}
                    <p className="flex-1 text-sm font-medium text-gray-800">{idea.text}</p>
                    <span data-testid={`ri-avg-${idea.ideaId}`} className="text-sm font-bold text-amber-600">
                      {avg > 0 ? avg.toFixed(1) : "-"}★
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        data-testid={`ri-bar-${idea.ideaId}`}
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{ratingCount} 票</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
