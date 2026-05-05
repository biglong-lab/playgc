import { useState } from "react";
import { Loader2, Send, Eye, HelpCircle } from "lucide-react";

export interface CuriosityEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  question: string;
}

export interface CuriosityMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  placeholder: string;
  maxLength: number;
}

export interface CuriosityMapState extends Record<string, unknown> {
  entries: CuriosityEntry[];
  revealed: boolean;
}

interface CuriosityMapProps {
  config: CuriosityMapConfig;
  state: CuriosityMapState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (question: string) => void;
  onReveal: () => void;
}

const BG_COLORS = [
  "bg-sky-50 border-sky-200 text-sky-800",
  "bg-violet-50 border-violet-200 text-violet-800",
  "bg-amber-50 border-amber-200 text-amber-800",
  "bg-teal-50 border-teal-200 text-teal-800",
  "bg-rose-50 border-rose-200 text-rose-800",
  "bg-lime-50 border-lime-200 text-lime-800",
];

export function CuriosityMap({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: CuriosityMapProps) {
  const [question, setQuestion] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  const { title, prompt, placeholder, maxLength } = config;
  const { entries, revealed } = state;
  const myEntry = entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;
  const canSubmit = question.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(question.trim());
    setQuestion("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="cm-title" className="text-xl font-bold text-center text-sky-700">
        {title}
      </h2>
      <p data-testid="cm-prompt" className="text-center text-gray-600 text-sm">
        {prompt}
      </p>
      <p data-testid="cm-count" className="text-sm text-gray-500 text-center">
        已收集 {entries.length} 個好奇心
      </p>

      {!hasSubmitted && !revealed && (
        <div className="space-y-2">
          <textarea
            data-testid="cm-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, maxLength))}
            placeholder={placeholder}
            rows={2}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {question.length}/{maxLength}
            </span>
            <button
              data-testid="cm-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              <Send size={14} />
              送出好奇心
            </button>
          </div>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div
          data-testid="cm-my-entry"
          className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-700"
        >
          <HelpCircle size={16} className="mt-0.5 shrink-0" />
          <span>{myEntry?.question}</span>
        </div>
      )}

      {isTeamLead && !revealed && entries.length > 0 && (
        <button
          data-testid="cm-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開好奇心地圖
        </button>
      )}

      {revealed && (
        <div data-testid="cm-result" className="space-y-2">
          <p className="text-center text-sm font-semibold text-gray-600 mb-3">
            🗺️ 全隊好奇心地圖
          </p>
          {entries.length === 0 && (
            <p data-testid="cm-empty" className="text-center text-gray-400 text-sm">
              還沒有人提問
            </p>
          )}
          {entries.map((e, i) => (
            <div
              key={e.entryId}
              data-testid={`cm-entry-${e.entryId}`}
              className={`border rounded-xl p-3 text-sm flex items-start gap-2 ${BG_COLORS[i % BG_COLORS.length]}`}
            >
              <HelpCircle size={14} className="mt-0.5 shrink-0 opacity-60" />
              <div>
                <span className="font-medium block">{e.userName}</span>
                <span>{e.question}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CuriosityMap;
