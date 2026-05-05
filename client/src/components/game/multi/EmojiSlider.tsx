import { useState } from "react";

export interface SliderResponse extends Record<string, unknown> {
  responseId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface EmojiSliderConfig extends Record<string, unknown> {
  title: string;
  question: string;
  leftEmoji: string;
  rightEmoji: string;
  leftLabel: string;
  rightLabel: string;
}

export interface EmojiSliderState extends Record<string, unknown> {
  responses: SliderResponse[];
  revealed: boolean;
}

const DEFAULT_CONFIG: EmojiSliderConfig = {
  title: "情緒滑桿",
  question: "你現在的感受？",
  leftEmoji: "😞",
  rightEmoji: "😄",
  leftLabel: "很低落",
  rightLabel: "很開心",
};

interface Props {
  config: EmojiSliderConfig;
  state: EmojiSliderState;
  myUserId: string;
  onSubmit: (value: number) => void;
  onReveal: () => void;
}

function lerp(t: number, a: string, b: string): string {
  const parse = (s: string) =>
    s.startsWith("#")
      ? [
          parseInt(s.slice(1, 3), 16),
          parseInt(s.slice(3, 5), 16),
          parseInt(s.slice(5, 7), 16),
        ]
      : [148, 103, 189];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bv = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bv})`;
}

export default function EmojiSlider({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [sliderVal, setSliderVal] = useState(50);

  const { responses, revealed } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const question = config.question || DEFAULT_CONFIG.question;
  const leftEmoji = config.leftEmoji || DEFAULT_CONFIG.leftEmoji;
  const rightEmoji = config.rightEmoji || DEFAULT_CONFIG.rightEmoji;
  const leftLabel = config.leftLabel || DEFAULT_CONFIG.leftLabel;
  const rightLabel = config.rightLabel || DEFAULT_CONFIG.rightLabel;

  const myResponse = responses.find((r) => r.userId === myUserId);
  const avg =
    responses.length > 0
      ? Math.round(responses.reduce((s, r) => s + r.value, 0) / responses.length)
      : null;

  const buckets: number[] = new Array(10).fill(0);
  for (const r of responses) {
    const idx = Math.min(9, Math.floor(r.value / 10));
    buckets[idx]++;
  }
  const maxBucket = Math.max(...buckets, 1);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="es-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="es-question"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {question}
      </p>

      {!revealed && (
        <div className="space-y-4">
          {!myResponse ? (
            <div className="space-y-3">
              <div className="flex justify-between text-2xl px-1">
                <span>{leftEmoji}</span>
                <span>{rightEmoji}</span>
              </div>
              <input
                data-testid="es-slider"
                type="range"
                min={0}
                max={100}
                value={sliderVal}
                onChange={(e) => setSliderVal(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
              </div>
              <p className="text-center text-sm text-gray-500">
                目前位置：<span data-testid="es-preview-value">{sliderVal}</span>
              </p>
              <div className="text-center">
                <button
                  data-testid="es-submit-btn"
                  onClick={() => onSubmit(sliderVal)}
                  className="px-8 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
                >
                  提交
                </button>
              </div>
            </div>
          ) : (
            <p data-testid="es-my-response" className="text-center text-sm text-gray-500">
              ✅ 已提交：{myResponse.value}
            </p>
          )}
          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="es-count">{responses.length}</span> 人提交
          </p>
          <div className="text-center">
            <button
              data-testid="es-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布結果
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="space-y-4">
          {responses.length === 0 ? (
            <div data-testid="es-empty" className="text-center text-gray-400 py-8">
              尚無人提交
            </div>
          ) : (
            <>
              <div className="flex justify-between text-2xl px-1">
                <span>{leftEmoji}</span>
                <span>{rightEmoji}</span>
              </div>
              <div
                data-testid="es-bars"
                className="flex items-end gap-1 h-20 px-1"
              >
                {buckets.map((count, i) => (
                  <div
                    key={i}
                    data-testid={`es-bar-${i}`}
                    title={`${count} 人`}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${(count / maxBucket) * 100}%`,
                      minHeight: count > 0 ? "4px" : "0",
                      backgroundColor:
                        count > 0
                          ? lerp(i / 9, "#7c3aed", "#f59e0b")
                          : "#e5e7eb",
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
              </div>
              {avg !== null && (
                <p
                  data-testid="es-avg"
                  className="text-center text-sm font-semibold text-violet-700"
                >
                  平均值：{avg} / 100
                </p>
              )}
              <p className="text-xs text-center text-gray-400">
                共 {responses.length} 人填答
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
