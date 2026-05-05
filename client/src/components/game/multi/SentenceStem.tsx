import { useState } from "react";
import { Loader2, Send, CheckCircle, Eye } from "lucide-react";

export interface StemEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  completion: string;
}

export interface SentenceStemConfig extends Record<string, unknown> {
  title: string;
  stemText: string;
  placeholder: string;
  maxLength: number;
}

export interface SentenceStemState extends Record<string, unknown> {
  entries: StemEntry[];
  revealed: boolean;
}

interface SentenceStemProps {
  config: SentenceStemConfig;
  state: SentenceStemState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (completion: string) => void;
  onReveal: () => void;
}

export function SentenceStem({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: SentenceStemProps) {
  const [completion, setCompletion] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  const { title, stemText, placeholder, maxLength } = config;
  const { entries, revealed } = state;
  const myEntry = entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;

  function handleSubmit() {
    const trimmed = completion.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setCompletion("");
  }

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ss-title" className="text-xl font-bold text-center text-purple-700">
        {title}
      </h2>

      <div
        data-testid="ss-stem"
        className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-lg font-medium text-purple-800 text-center"
      >
        {stemText}
      </div>

      <p data-testid="ss-count" className="text-sm text-gray-500 text-center">
        已有 {entries.length} 人完成
      </p>

      {!hasSubmitted && !revealed && (
        <div className="space-y-2">
          <textarea
            data-testid="ss-input"
            value={completion}
            onChange={(e) => setCompletion(e.target.value.slice(0, maxLength))}
            placeholder={placeholder}
            rows={2}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {completion.length}/{maxLength}
            </span>
            <button
              data-testid="ss-submit-btn"
              onClick={handleSubmit}
              disabled={!completion.trim()}
              className="flex items-center gap-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              <Send size={14} />
              完成句子
            </button>
          </div>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div
          data-testid="ss-my-entry"
          className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700"
        >
          <CheckCircle size={16} />
          <span>
            <strong>{stemText}</strong> {myEntry.completion}
          </span>
        </div>
      )}

      {isTeamLead && !revealed && entries.length > 0 && (
        <button
          data-testid="ss-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開所有答案
        </button>
      )}

      {revealed && (
        <div data-testid="ss-result" className="space-y-2">
          <p className="text-center text-sm font-semibold text-gray-600">所有人的完成句：</p>
          {entries.length === 0 && (
            <p data-testid="ss-empty" className="text-center text-gray-400 text-sm">
              還沒有人填寫
            </p>
          )}
          {entries.map((e) => (
            <div
              key={e.entryId}
              data-testid={`ss-entry-${e.entryId}`}
              className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm"
            >
              <span className="font-medium text-purple-700">{e.userName}：</span>
              <span className="text-gray-700">
                {stemText} {e.completion}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SentenceStem;
