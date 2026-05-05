export interface RetroColumn {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export interface RetroCard {
  id: string;
  columnId: string;
  userId: string;
  userName: string;
  text: string;
  votes: string[];
  addedAt: number;
}

export interface RetroBoardConfig {
  title: string;
  prompt?: string;
  columns: RetroColumn[];
  maxCardsPerColumn: number;
  allowVoting: boolean;
}

export interface RetroBoardState extends Record<string, unknown> {
  cards: RetroCard[];
  phase: "add" | "vote" | "done";
  hostUserId: string | null;
}

interface RetroBoardProps {
  config: RetroBoardConfig;
  state: RetroBoardState;
  myUserId: string;
  draftColumnId: string;
  draftText: string;
  onColumnSelect: (columnId: string) => void;
  onTextChange: (text: string) => void;
  onAddCard: () => void;
  onVote: (cardId: string) => void;
  onAdvancePhase: () => void;
}

const COLOR_MAP: Record<string, string> = {
  green: "bg-green-50 border-green-200",
  red: "bg-red-50 border-red-200",
  blue: "bg-blue-50 border-blue-200",
  yellow: "bg-yellow-50 border-yellow-200",
  purple: "bg-purple-50 border-purple-200",
  orange: "bg-orange-50 border-orange-200",
};

const HEADER_MAP: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-yellow-100 text-yellow-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

export default function RetroBoard({
  config,
  state,
  myUserId,
  draftColumnId,
  draftText,
  onColumnSelect,
  onTextChange,
  onAddCard,
  onVote,
  onAdvancePhase,
}: RetroBoardProps) {
  const isHost = state.hostUserId === myUserId || (state.cards.length === 0 && state.hostUserId === null);

  const getColumnCards = (columnId: string) =>
    state.cards
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => b.votes.length - a.votes.length || a.addedAt - b.addedAt);

  const myColumnCount = (columnId: string) =>
    state.cards.filter((c) => c.columnId === columnId && c.userId === myUserId).length;

  const canAdd =
    state.phase === "add" &&
    draftColumnId !== "" &&
    draftText.trim() !== "" &&
    myColumnCount(draftColumnId) < config.maxCardsPerColumn;

  return (
    <div data-testid="retro-board-root" className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 data-testid="retro-title" className="text-xl font-bold text-slate-800">
          {config.title}
        </h2>
        <span
          data-testid="retro-phase"
          className={`text-xs px-2 py-1 rounded-full font-semibold ${
            state.phase === "add"
              ? "bg-indigo-100 text-indigo-600"
              : state.phase === "vote"
                ? "bg-amber-100 text-amber-600"
                : "bg-green-100 text-green-600"
          }`}
        >
          {state.phase === "add" ? "收集中" : state.phase === "vote" ? "投票中" : "完成"}
        </span>
      </div>

      {config.prompt && (
        <p data-testid="retro-prompt" className="text-sm text-slate-500">
          {config.prompt}
        </p>
      )}

      <div data-testid="card-count" className="text-xs text-slate-400">
        共 <span className="font-semibold text-indigo-600">{state.cards.length}</span> 張卡片
      </div>

      {/* 新增表單 */}
      {state.phase === "add" && (
        <div data-testid="add-card-form" className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
          <div className="flex gap-2 flex-wrap">
            {config.columns.map((col) => (
              <button
                key={col.id}
                data-testid={`col-select-${col.id}`}
                onClick={() => onColumnSelect(col.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  draftColumnId === col.id
                    ? "ring-2 ring-indigo-400 " + HEADER_MAP[col.color]
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {col.emoji} {col.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="card-text-input"
              type="text"
              value={draftText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="輸入你的想法…"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              maxLength={80}
              onKeyDown={(e) => e.key === "Enter" && canAdd && onAddCard()}
            />
            <button
              data-testid="add-card-btn"
              onClick={onAddCard}
              disabled={!canAdd}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </div>
      )}

      {/* 欄位與卡片 */}
      <div className="grid grid-cols-1 gap-3">
        {config.columns.map((col) => {
          const cards = getColumnCards(col.id);
          return (
            <div
              key={col.id}
              data-testid={`retro-column-${col.id}`}
              className={`rounded-xl border p-3 ${COLOR_MAP[col.color] ?? "bg-slate-50 border-slate-200"}`}
            >
              <div
                className={`flex items-center justify-between mb-2 px-2 py-1 rounded-lg ${HEADER_MAP[col.color] ?? "bg-slate-100 text-slate-600"}`}
              >
                <span className="text-sm font-bold">
                  {col.emoji} {col.label}
                </span>
                <span className="text-xs">{cards.length} 張</span>
              </div>
              <div className="space-y-1.5 min-h-10">
                {cards.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">尚無卡片</p>
                )}
                {cards.map((card) => {
                  const hasVoted = card.votes.includes(myUserId);
                  return (
                    <div
                      key={card.id}
                      data-testid={`card-${card.id}`}
                      className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 shadow-sm"
                    >
                      <div className="flex-1">
                        <p data-testid={`card-text-${card.id}`} className="text-sm text-slate-700">
                          {card.text}
                        </p>
                        <p data-testid={`card-author-${card.id}`} className="text-xs text-slate-400 mt-0.5">
                          {card.userName}
                        </p>
                      </div>
                      {config.allowVoting && state.phase !== "add" && (
                        <button
                          data-testid={`vote-btn-${card.id}`}
                          onClick={() => onVote(card.id)}
                          disabled={card.userId === myUserId}
                          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                            hasVoted
                              ? "bg-indigo-100 text-indigo-600"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                          }`}
                        >
                          👍
                          <span data-testid={`vote-count-${card.id}`}>{card.votes.length}</span>
                        </button>
                      )}
                      {(state.phase === "add" || !config.allowVoting) && (
                        <span data-testid={`vote-count-${card.id}`} className="text-xs text-slate-400 flex-shrink-0">
                          {card.votes.length > 0 ? `👍 ${card.votes.length}` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 主持人控制 */}
      {isHost && state.phase === "add" && (
        <button
          data-testid="start-vote-btn"
          onClick={onAdvancePhase}
          className="w-full py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition"
        >
          開始投票（{state.cards.length} 張卡片）
        </button>
      )}
      {isHost && state.phase === "vote" && (
        <button
          data-testid="finish-retro-btn"
          onClick={onAdvancePhase}
          className="w-full py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition"
        >
          結束回顧
        </button>
      )}

      {state.phase === "done" && (
        <div data-testid="retro-done" className="p-3 bg-green-50 rounded-xl text-sm text-green-700 text-center">
          ✅ 回顧完成！感謝大家的貢獻
        </div>
      )}
    </div>
  );
}
