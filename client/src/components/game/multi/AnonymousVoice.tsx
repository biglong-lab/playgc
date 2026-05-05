import React, { useState } from "react";

export interface AnonymousVoiceConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface AnonEntry extends Record<string, unknown> {
  entryId: string;
  text: string;
  hearts: string[];
}

export interface AnonymousVoiceState extends Record<string, unknown> {
  entries: AnonEntry[];
  submitterIds: string[];
  revealed: boolean;
}

interface Props {
  config: AnonymousVoiceConfig;
  state: AnonymousVoiceState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
  onHeart: (entryId: string) => void;
}

export default function AnonymousVoice({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const { title, prompt, maxLength } = config;
  const { entries, submitterIds, revealed } = state;

  const hasSubmitted = submitterIds.includes(myUserId);
  const [text, setText] = useState("");

  const canSubmit = text.trim().length > 0 && text.length <= maxLength && !hasSubmitted;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div data-testid="av-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="av-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="av-prompt" className="text-sm text-center text-gray-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
        {prompt}
      </p>

      <div data-testid="av-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-slate-600">{entries.length}</span> 則心聲
        <span className="ml-2 text-xs text-slate-400">（完全匿名）</span>
      </div>

      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          <textarea
            data-testid="av-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="輸入你想說的話…不會顯示你的名字"
            rows={3}
            maxLength={maxLength + 10}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
          />
          {text.length > maxLength && (
            <p data-testid="av-error" className="text-xs text-red-500 text-center">
              最多 {maxLength} 字
            </p>
          )}

          <button
            data-testid="av-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-slate-600 text-white font-bold rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            匿名送出
          </button>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div data-testid="av-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <p className="text-green-700 font-semibold text-sm">✅ 已匿名送出！等待揭曉</p>
          <p className="text-xs text-gray-400 mt-1">目前 {submitterIds.length} 人已送出</p>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="av-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉所有心聲
        </button>
      ) : (
        <div data-testid="av-result" className="flex flex-col gap-3">
          {entries.length === 0 ? (
            <div data-testid="av-empty" className="text-center text-gray-400 p-8">
              還沒有人送出心聲
            </div>
          ) : (
            entries.map((entry) => {
              const hearted = entry.hearts.includes(myUserId);
              return (
                <div
                  key={entry.entryId}
                  data-testid={`av-entry-${entry.entryId}`}
                  className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
                >
                  <p
                    data-testid={`av-entry-text-${entry.entryId}`}
                    className="text-sm text-gray-700"
                  >
                    {entry.text}
                  </p>
                  <div className="flex justify-end mt-2">
                    <button
                      data-testid={`av-heart-${entry.entryId}`}
                      onClick={() => onHeart(entry.entryId)}
                      className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                        hearted ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                      }`}
                    >
                      {hearted ? "❤️" : "🤍"}
                      <span data-testid={`av-heart-count-${entry.entryId}`}>
                        {entry.hearts.length}
                      </span>
                    </button>
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
