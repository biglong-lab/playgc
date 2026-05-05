import { useState } from "react";

export interface TastingEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  itemName: string;
  rating: number;
  notes: string;
  hearts: string[];
}

export interface TastingNotesConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  itemLabel: string;
  showItemName: boolean;
  maxNotesLength: number;
  showAuthor: boolean;
}

export interface TastingNotesState extends Record<string, unknown> {
  entries: TastingEntry[];
  revealed: boolean;
}

const DEFAULT_CONFIG: TastingNotesConfig = {
  title: "品鑑筆記",
  prompt: "寫下你的品鑑感受",
  itemLabel: "品項名稱",
  showItemName: true,
  maxNotesLength: 100,
  showAuthor: true,
};

const STAR_LABELS = ["", "很差", "普通", "不錯", "很好", "絕讚"];

interface Props {
  config: TastingNotesConfig;
  state: TastingNotesState;
  myUserId: string;
  onSubmit: (entry: {
    itemName: string;
    rating: number;
    notes: string;
  }) => void;
  onReveal: () => void;
  onHeart: (entryId: string) => void;
}

export default function TastingNotes({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const [itemName, setItemName] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");

  const showItemName =
    config.showItemName ?? DEFAULT_CONFIG.showItemName;
  const showAuthor =
    config.showAuthor ?? DEFAULT_CONFIG.showAuthor;
  const maxNotesLength =
    config.maxNotesLength ?? DEFAULT_CONFIG.maxNotesLength;

  const myEntry = state.entries.find((e) => e.userId === myUserId);
  const overLimit = notes.length > maxNotesLength;
  const canSubmit =
    rating > 0 &&
    notes.trim().length > 0 &&
    !overLimit &&
    !myEntry &&
    (!showItemName || itemName.trim().length > 0);

  const sorted = state.revealed
    ? [...state.entries].sort(
        (a, b) => b.hearts.length - a.hearts.length
      )
    : state.entries;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      itemName: showItemName ? itemName.trim() : "",
      rating,
      notes: notes.trim(),
    });
    setItemName("");
    setRating(0);
    setNotes("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="tn-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="tn-prompt"
        className="text-center text-gray-600"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {!myEntry && (
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
          {showItemName && (
            <input
              data-testid="tn-item-input"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={
                config.itemLabel || DEFAULT_CONFIG.itemLabel
              }
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          )}
          <div className="flex items-center gap-1">
            <span
              data-testid="tn-rating-label"
              className="text-sm text-gray-600 mr-2"
            >
              評分：
            </span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                data-testid={`tn-star-${s}`}
                onClick={() => setRating(s)}
                className={`text-2xl transition-transform hover:scale-110 ${
                  s <= rating ? "opacity-100" : "opacity-30"
                }`}
              >
                ⭐
              </button>
            ))}
            {rating > 0 && (
              <span
                data-testid="tn-rating-label-text"
                className="ml-2 text-sm text-amber-600"
              >
                {STAR_LABELS[rating]}
              </span>
            )}
          </div>
          <textarea
            data-testid="tn-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="寫下你的品鑑感受、香氣、口感…"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <div className="flex items-center justify-between">
            <span
              data-testid="tn-char-count"
              className={`text-xs ${
                overLimit ? "text-red-500" : "text-gray-400"
              }`}
            >
              {notes.length}/{maxNotesLength}
            </span>
            {overLimit && (
              <span
                data-testid="tn-char-error"
                className="text-xs text-red-500"
              >
                超過字數限制
              </span>
            )}
            <button
              data-testid="tn-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-amber-700 disabled:cursor-not-allowed"
            >
              送出品鑑
            </button>
          </div>
        </div>
      )}

      {myEntry && (
        <p
          data-testid="tn-submitted-msg"
          className="text-center text-sm text-green-600"
        >
          ✅ 已送出品鑑筆記
        </p>
      )}

      <div className="flex items-center justify-between">
        <p
          data-testid="tn-count"
          className="text-xs text-gray-400"
        >
          已送出：{state.entries.length} 份
        </p>
        {!state.revealed && (
          <button
            data-testid="tn-reveal-btn"
            onClick={onReveal}
            className="px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"
          >
            揭曉品鑑結果
          </button>
        )}
      </div>

      {state.revealed && sorted.length === 0 && (
        <div
          data-testid="tn-empty"
          className="text-center text-gray-400 py-8"
        >
          尚無品鑑記錄
        </div>
      )}

      {state.revealed && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((entry) => {
            const hasHearted = entry.hearts.includes(myUserId);
            return (
              <div
                key={entry.entryId}
                data-testid={`tn-entry-${entry.entryId}`}
                className="p-3 bg-white border border-amber-100 rounded-lg shadow-sm"
              >
                {showItemName && entry.itemName && (
                  <p className="text-xs text-amber-600 font-medium mb-1">
                    {entry.itemName}
                  </p>
                )}
                <div
                  data-testid={`tn-entry-rating-${entry.entryId}`}
                  className="flex gap-0.5 mb-1"
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className={
                        s <= entry.rating
                          ? "opacity-100"
                          : "opacity-20"
                      }
                    >
                      ⭐
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-amber-600">
                    {STAR_LABELS[entry.rating]}
                  </span>
                </div>
                <p className="text-sm">{entry.notes}</p>
                {showAuthor && (
                  <p
                    data-testid={`tn-author-${entry.entryId}`}
                    className="text-xs text-gray-400 mt-1"
                  >
                    — {entry.userName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    data-testid={`tn-heart-${entry.entryId}`}
                    onClick={() => onHeart(entry.entryId)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      hasHearted
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-500 hover:bg-red-50"
                    }`}
                  >
                    ❤️{" "}
                    <span
                      data-testid={`tn-heart-count-${entry.entryId}`}
                    >
                      {entry.hearts.length}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
