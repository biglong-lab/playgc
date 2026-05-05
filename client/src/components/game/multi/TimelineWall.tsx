export interface TimelineEntry {
  id: string;
  userId: string;
  userName: string;
  yearLabel: string;
  text: string;
  emoji?: string;
  addedAt: number;
}

export interface TimelineWallConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxEntriesPerPerson: number;
  maxTextLength: number;
  showAuthor: boolean;
}

export interface TimelineWallState extends Record<string, unknown> {
  entries: TimelineEntry[];
}

interface TimelineWallProps {
  config: TimelineWallConfig;
  state: TimelineWallState;
  myUserId: string;
  draftYear: string;
  draftText: string;
  draftEmoji: string;
  onYearChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onAdd: () => void;
}

const EMOJI_SUGGESTIONS = ["🎓", "💑", "🎉", "🏆", "🌏", "📸", "🎵", "💼", "🏡", "👶", "✈️", "❤️"];

export default function TimelineWall({
  config,
  state,
  myUserId,
  draftYear,
  draftText,
  draftEmoji,
  onYearChange,
  onTextChange,
  onEmojiChange,
  onAdd,
}: TimelineWallProps) {
  const myCount = state.entries.filter((e) => e.userId === myUserId).length;
  const canAdd = myCount < config.maxEntriesPerPerson && draftYear.trim() !== "" && draftText.trim() !== "";

  const sorted = [...state.entries].sort((a, b) => {
    const ya = parseInt(a.yearLabel) || 0;
    const yb = parseInt(b.yearLabel) || 0;
    return ya !== yb ? ya - yb : a.addedAt - b.addedAt;
  });

  return (
    <div data-testid="timeline-wall-root" className="p-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 data-testid="timeline-title" className="text-xl font-bold text-slate-800">
          {config.title}
        </h2>
        {config.prompt && (
          <p data-testid="timeline-prompt" className="text-sm text-slate-500 mt-1">
            {config.prompt}
          </p>
        )}
      </div>

      <div data-testid="entry-count" className="text-xs text-slate-400">
        共 <span className="font-semibold text-indigo-600">{state.entries.length}</span> 則回憶 · 我已加{" "}
        <span className="font-semibold">{myCount}</span> / {config.maxEntriesPerPerson} 則
      </div>

      {myCount < config.maxEntriesPerPerson && (
        <div data-testid="add-entry-form" className="p-3 bg-indigo-50 rounded-xl space-y-2">
          <div className="flex gap-2">
            <input
              data-testid="year-input"
              type="text"
              value={draftYear}
              onChange={(e) => onYearChange(e.target.value)}
              placeholder="年份（如 2015）"
              className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              maxLength={10}
            />
            <input
              data-testid="text-input"
              type="text"
              value={draftText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={config.placeholder ?? "寫下這一年的回憶…"}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              maxLength={config.maxTextLength}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {EMOJI_SUGGESTIONS.map((em) => (
              <button
                key={em}
                data-testid={`emoji-btn-${em}`}
                onClick={() => onEmojiChange(em === draftEmoji ? "" : em)}
                className={`text-lg rounded-lg px-1 transition ${draftEmoji === em ? "bg-indigo-200 ring-2 ring-indigo-400" : "hover:bg-slate-200"}`}
              >
                {em}
              </button>
            ))}
          </div>

          <button
            data-testid="add-entry-btn"
            onClick={onAdd}
            disabled={!canAdd}
            className="w-full py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-40"
          >
            加入時間軸
          </button>
        </div>
      )}

      {myCount >= config.maxEntriesPerPerson && (
        <div data-testid="max-reached" className="text-sm text-center text-slate-400 py-2">
          你已加完 {config.maxEntriesPerPerson} 則回憶 ✅
        </div>
      )}

      {sorted.length === 0 && (
        <div data-testid="empty-timeline" className="text-center text-slate-400 py-8 text-sm">
          還沒有人加入回憶，快來第一個！
        </div>
      )}

      <div data-testid="timeline-entries" className="relative">
        {sorted.length > 0 && <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-indigo-100" />}
        <div className="space-y-3">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              data-testid={`entry-${entry.id}`}
              className="flex gap-3 relative"
            >
              <div className="flex-shrink-0 w-16 text-right">
                <span
                  data-testid={`entry-year-${entry.id}`}
                  className="text-xs font-bold text-indigo-500 bg-white border border-indigo-200 rounded-full px-2 py-0.5"
                >
                  {entry.yearLabel}
                </span>
              </div>
              <div className="relative flex-1 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  {entry.emoji && (
                    <span data-testid={`entry-emoji-${entry.id}`} className="text-xl flex-shrink-0">
                      {entry.emoji}
                    </span>
                  )}
                  <div className="flex-1">
                    <p data-testid={`entry-text-${entry.id}`} className="text-sm text-slate-700">
                      {entry.text}
                    </p>
                    {config.showAuthor && (
                      <p data-testid={`entry-author-${entry.id}`} className="text-xs text-slate-400 mt-1">
                        — {entry.userName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
