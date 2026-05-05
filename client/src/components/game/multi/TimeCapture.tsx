import React from "react";

export interface TimeCaptureConfig {
  title: string;
  prompt: string;
  openDate?: string; // ISO date string, optional
  maxLength: number;
  showAuthor: boolean;
}

export interface CapsuleMessage {
  msgId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface TimeCaptureState extends Record<string, unknown> {
  messages: CapsuleMessage[];
  revealed: boolean;
}

interface Props {
  config: TimeCaptureConfig;
  state: TimeCaptureState;
  myUserId: string;
  draftText: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}

export default function TimeCapture({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, openDate, maxLength, showAuthor } = config;
  const { messages, revealed } = state;

  const myMessage = messages.find((m) => m.userId === myUserId);
  const hasSubmitted = !!myMessage;
  const canSubmit = draftText.trim().length > 0;

  const daysUntil = openDate ? getDaysUntil(openDate) : 0;
  const isOpenDatePast = openDate ? daysUntil === 0 : true;

  return (
    <div data-testid="tc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <div className="text-center">
        <div className="text-4xl mb-1">🕰️</div>
        <h2 data-testid="tc-title" className="text-lg font-bold">{title}</h2>
        <p data-testid="tc-prompt" className="text-sm text-gray-500 mt-1">{prompt}</p>
      </div>

      {/* 開啟日期倒計時 */}
      {openDate && !revealed && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-xs text-amber-500 font-medium">膠囊開啟日期</p>
          <p data-testid="tc-open-date" className="text-sm font-bold text-amber-700">
            {formatDate(openDate)}
          </p>
          {!isOpenDatePast && (
            <p data-testid="tc-countdown" className="text-xs text-amber-400 mt-1">
              還有 {daysUntil} 天
            </p>
          )}
        </div>
      )}

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-amber-200 bg-amber-100">
              <p className="text-xs text-amber-700 font-medium">✉️ 寫下給未來的訊息</p>
            </div>
            <textarea
              data-testid="tc-input"
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              maxLength={maxLength}
              rows={4}
              placeholder="寫下你現在的心情、目標、或給未來自己的話…"
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none bg-transparent"
            />
            <div className="px-3 py-1 text-xs text-gray-400 text-right">
              {draftText.length}/{maxLength}
            </div>
          </div>

          <button
            data-testid="tc-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            封存 🔒
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="tc-submitted-msg" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold text-amber-700">訊息已封存！</p>
          <p className="text-xs text-amber-500 mt-1">
            {openDate ? `${formatDate(openDate)} 開啟` : "等待主持人開啟"}
          </p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="tc-count">{messages.length}</span> 則訊息已封存
          </p>
          <button
            data-testid="tc-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
          >
            開啟時空膠囊 🔓
          </button>
        </div>
      )}

      {/* 揭曉後 */}
      {revealed && (
        <div data-testid="tc-result" className="flex flex-col gap-3">
          <div className="text-center">
            <p className="text-2xl mb-1">📬</p>
            <p className="text-indigo-600 text-sm font-semibold">
              時空膠囊已開啟！共 {messages.length} 則訊息
            </p>
            {openDate && (
              <p className="text-xs text-gray-400 mt-1">
                開啟日期：{formatDate(openDate)}
              </p>
            )}
          </div>

          {messages.length === 0 ? (
            <p data-testid="tc-empty" className="text-center text-gray-400 text-sm py-4">
              膠囊裡沒有任何訊息
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.msgId}
                data-testid={`tc-msg-${msg.msgId}`}
                className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📜</span>
                  {showAuthor && (
                    <span data-testid={`tc-author-${msg.msgId}`} className="text-xs text-gray-400 font-semibold">
                      {msg.userName}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{msg.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
