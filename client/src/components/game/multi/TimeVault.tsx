import { useState } from "react";

export interface VaultEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  text: string;
  hearts: string[];
}

export interface TimeVaultConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  revealLabel: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface TimeVaultState extends Record<string, unknown> {
  entries: VaultEntry[];
  phase: "submit" | "sealed" | "revealed";
}

const DEFAULT_CONFIG: TimeVaultConfig = {
  title: "時光膠囊",
  prompt: "寫下你想在未來開封時看到的話",
  revealLabel: "下次聚會開封",
  maxLength: 150,
  showAuthor: true,
};

const PHASE_LABELS: Record<TimeVaultState["phase"], string> = {
  submit: "封存中",
  sealed: "已封存",
  revealed: "開封",
};

const PHASE_ADVANCE_LABELS: Partial<
  Record<TimeVaultState["phase"], string>
> = {
  submit: "🔒 封存膠囊",
  sealed: "🎉 開封時光膠囊",
};

interface Props {
  config: TimeVaultConfig;
  state: TimeVaultState;
  myUserId: string;
  onSubmitEntry: (text: string) => void;
  onAdvancePhase: () => void;
  onHeart: (entryId: string) => void;
}

export default function TimeVault({
  config,
  state,
  myUserId,
  onSubmitEntry,
  onAdvancePhase,
  onHeart,
}: Props) {
  const [text, setText] = useState("");

  const maxLength = config.maxLength ?? DEFAULT_CONFIG.maxLength;
  const showAuthor = config.showAuthor ?? DEFAULT_CONFIG.showAuthor;
  const { entries, phase } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const overLimit = text.length > maxLength;
  const canSubmit =
    text.trim().length > 0 && !overLimit && !myEntry;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitEntry(text.trim());
    setText("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="text-center space-y-1">
        <h2
          data-testid="tv-title"
          className="text-xl font-bold"
        >
          {config.title || DEFAULT_CONFIG.title}
        </h2>
        <div
          data-testid="tv-phase"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm"
        >
          {PHASE_LABELS[phase]}
        </div>
        <p
          data-testid="tv-reveal-label"
          className="text-xs text-gray-400"
        >
          📅 {config.revealLabel || DEFAULT_CONFIG.revealLabel}
        </p>
      </div>

      <p
        data-testid="tv-prompt"
        className="text-center text-gray-600 text-sm"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {phase === "submit" && !myEntry && (
        <div className="space-y-2">
          <textarea
            data-testid="tv-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在這裡寫下你的訊息，等待未來的你看到…"
            rows={4}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                data-testid="tv-char-count"
                className={`text-xs ${
                  overLimit ? "text-red-500" : "text-gray-400"
                }`}
              >
                {text.length}/{maxLength}
              </span>
              {overLimit && (
                <span
                  data-testid="tv-char-error"
                  className="text-xs text-red-500"
                >
                  超過字數限制
                </span>
              )}
            </div>
            <button
              data-testid="tv-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-indigo-700 disabled:cursor-not-allowed"
            >
              放入膠囊
            </button>
          </div>
        </div>
      )}

      {phase === "submit" && myEntry && (
        <div
          data-testid="tv-submitted-msg"
          className="text-center p-4 bg-indigo-50 rounded-lg"
        >
          <p className="text-indigo-700 font-medium">
            ✅ 你的訊息已放入膠囊
          </p>
          <p className="text-xs text-indigo-400 mt-1">
            等待其他人完成後封存
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p
          data-testid="tv-count"
          className="text-sm text-gray-500"
        >
          已放入：{entries.length} 則訊息
        </p>
        {PHASE_ADVANCE_LABELS[phase] && (
          <button
            data-testid="tv-advance-btn"
            onClick={onAdvancePhase}
            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {PHASE_ADVANCE_LABELS[phase]}
          </button>
        )}
      </div>

      {phase === "sealed" && (
        <div
          data-testid="tv-sealed-msg"
          className="text-center py-12 space-y-3"
        >
          <div className="text-6xl">🔒</div>
          <p className="font-bold text-gray-700">膠囊已封存</p>
          <p className="text-sm text-gray-400">
            {entries.length} 則訊息靜待開封
          </p>
          <p className="text-xs text-gray-400">
            📅 {config.revealLabel || DEFAULT_CONFIG.revealLabel}
          </p>
        </div>
      )}

      {phase === "revealed" && entries.length === 0 && (
        <div
          data-testid="tv-empty"
          className="text-center text-gray-400 py-8"
        >
          膠囊是空的
        </div>
      )}

      {phase === "revealed" && entries.length > 0 && (
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-2xl">🎉</span>
            <p className="text-sm font-medium text-indigo-700">
              時光膠囊開封！
            </p>
          </div>
          {entries.map((entry) => {
            const hasHearted = entry.hearts.includes(myUserId);
            return (
              <div
                key={entry.entryId}
                data-testid={`tv-entry-${entry.entryId}`}
                className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg"
              >
                <p className="text-sm leading-relaxed">
                  {entry.text}
                </p>
                {showAuthor && (
                  <p
                    data-testid={`tv-author-${entry.entryId}`}
                    className="text-xs text-indigo-400 mt-2"
                  >
                    — {entry.userName}
                  </p>
                )}
                <div className="mt-2">
                  <button
                    data-testid={`tv-heart-${entry.entryId}`}
                    onClick={() => onHeart(entry.entryId)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      hasHearted
                        ? "bg-red-100 text-red-600"
                        : "bg-white text-gray-400 hover:bg-red-50"
                    }`}
                  >
                    ❤️{" "}
                    <span
                      data-testid={`tv-heart-count-${entry.entryId}`}
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
