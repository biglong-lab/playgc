export interface SceneOption extends Record<string, unknown> {
  sceneId: string;
  label: string;
  emoji: string;
  description: string;
}

export interface SceneVoteRecord extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  sceneId: string;
}

export interface SceneVoteConfig extends Record<string, unknown> {
  title: string;
  question: string;
  scenes: SceneOption[];
}

export interface SceneVoteState extends Record<string, unknown> {
  votes: SceneVoteRecord[];
  revealed: boolean;
}

const DEFAULT_CONFIG: SceneVoteConfig = {
  title: "場景選擇",
  question: "你是哪一種人？",
  scenes: [],
};

interface Props {
  config: SceneVoteConfig;
  state: SceneVoteState;
  myUserId: string;
  onVote: (sceneId: string) => void;
  onReveal: () => void;
}

export default function SceneVote({
  config,
  state,
  myUserId,
  onVote,
  onReveal,
}: Props) {
  const { votes, revealed } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const question = config.question || DEFAULT_CONFIG.question;
  const scenes = config.scenes ?? DEFAULT_CONFIG.scenes;

  const myVote = votes.find((v) => v.userId === myUserId);

  const voteCounts: Record<string, number> = {};
  for (const v of votes) {
    voteCounts[v.sceneId] = (voteCounts[v.sceneId] ?? 0) + 1;
  }
  const maxVotes = Math.max(...Object.values(voteCounts), 1);

  const sortedScenes = revealed
    ? [...scenes].sort((a, b) => (voteCounts[b.sceneId] ?? 0) - (voteCounts[a.sceneId] ?? 0))
    : scenes;

  const topSceneId =
    revealed && sortedScenes.length > 0 ? sortedScenes[0].sceneId : null;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="sv-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="sv-question"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {question}
      </p>

      {scenes.length === 0 && (
        <p data-testid="sv-empty" className="text-center text-gray-400 py-8">
          尚未設定場景選項
        </p>
      )}

      {scenes.length > 0 && (
        <div className="space-y-2">
          {(revealed ? sortedScenes : scenes).map((scene) => {
            const count = voteCounts[scene.sceneId] ?? 0;
            const pct = Math.round((count / maxVotes) * 100);
            const isMyChoice = myVote?.sceneId === scene.sceneId;
            const isTop = scene.sceneId === topSceneId;

            return (
              <button
                key={scene.sceneId}
                data-testid={`sv-scene-${scene.sceneId}`}
                onClick={() => !revealed && onVote(scene.sceneId)}
                disabled={!!myVote || revealed}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                  isTop && revealed
                    ? "border-yellow-400 bg-yellow-50"
                    : isMyChoice
                    ? "border-violet-400 bg-violet-50"
                    : "border-gray-200 bg-white hover:border-violet-200 disabled:cursor-default"
                }`}
              >
                {revealed && (
                  <div
                    data-testid={`sv-bar-${scene.sceneId}`}
                    className="absolute inset-y-0 left-0 bg-violet-100 rounded-l-xl transition-all"
                    style={{ width: `${pct}%`, opacity: 0.5 }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  <span className="text-2xl">{scene.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {isTop && revealed && "🏆 "}
                      {scene.label}
                      {isMyChoice && " （我）"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {scene.description}
                    </p>
                  </div>
                  {revealed && (
                    <span
                      data-testid={`sv-count-${scene.sceneId}`}
                      className="text-sm font-bold text-violet-700 shrink-0"
                    >
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {myVote && !revealed && (
        <p className="text-center text-xs text-gray-400">✅ 已投票，等待公布</p>
      )}

      <p className="text-xs text-center text-gray-400">
        已有 <span data-testid="sv-total">{votes.length}</span> 人投票
      </p>

      {!revealed && (
        <div className="text-center">
          <button
            data-testid="sv-reveal-btn"
            onClick={onReveal}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
          >
            公布結果
          </button>
        </div>
      )}

      {revealed && topSceneId && (
        <p
          data-testid="sv-winner"
          className="text-center text-sm font-semibold text-yellow-700"
        >
          🏆 最多人選：{scenes.find((s) => s.sceneId === topSceneId)?.label}（
          {voteCounts[topSceneId] ?? 0} 票）
        </p>
      )}
    </div>
  );
}
