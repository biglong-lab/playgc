import React, { useState } from "react";

export interface PulseColor extends Record<string, unknown> {
  id: string;
  label: string;
  hex: string;
}

export interface ColorPulseConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  colors: PulseColor[];
  maxNoteLength: number;
  showAuthor: boolean;
}

export interface ColorResponse extends Record<string, unknown> {
  responseId: string;
  userId: string;
  userName: string;
  colorId: string;
  colorHex: string;
  colorLabel: string;
  note: string;
  hearts: string[];
}

export interface ColorPulseState extends Record<string, unknown> {
  responses: ColorResponse[];
  revealed: boolean;
}

const DEFAULT_COLORS: PulseColor[] = [
  { id: "red", label: "熱情紅", hex: "#ef4444" },
  { id: "orange", label: "活力橘", hex: "#f97316" },
  { id: "yellow", label: "陽光黃", hex: "#eab308" },
  { id: "green", label: "清新綠", hex: "#22c55e" },
  { id: "teal", label: "平靜青", hex: "#14b8a6" },
  { id: "blue", label: "深邃藍", hex: "#3b82f6" },
  { id: "purple", label: "神秘紫", hex: "#a855f7" },
  { id: "pink", label: "溫柔粉", hex: "#ec4899" },
  { id: "gray", label: "靜謐灰", hex: "#6b7280" },
  { id: "brown", label: "沉穩咖", hex: "#a16207" },
];

interface Props {
  config: ColorPulseConfig;
  state: ColorPulseState;
  myUserId: string;
  onSubmit: (colorId: string, colorHex: string, colorLabel: string, note: string) => void;
  onReveal: () => void;
  onHeart: (responseId: string) => void;
}

export default function ColorPulse({ config, state, myUserId, onSubmit, onReveal, onHeart }: Props) {
  const { title, prompt, colors, maxNoteLength, showAuthor } = config;
  const { responses, revealed } = state;

  const palette = colors.length > 0 ? colors : DEFAULT_COLORS;
  const myResponse = responses.find((r) => r.userId === myUserId);

  const [selectedColor, setSelectedColor] = useState<PulseColor | null>(null);
  const [note, setNote] = useState("");

  const canSubmit =
    selectedColor !== null && !myResponse && note.length <= maxNoteLength;

  function handleSubmit() {
    if (!canSubmit || !selectedColor) return;
    onSubmit(selectedColor.id, selectedColor.hex, selectedColor.label, note.trim());
    setSelectedColor(null);
    setNote("");
  }

  const colorGroups = palette.map((c) => ({
    color: c,
    count: responses.filter((r) => r.colorId === c.id).length,
  })).filter((g) => g.count > 0);

  return (
    <div data-testid="cp-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="cp-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="cp-prompt" className="text-sm text-center text-gray-600 bg-blue-50 p-3 rounded-xl border border-blue-100">
        {prompt}
      </p>

      <div data-testid="cp-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-blue-600">{responses.length}</span> 人已選色
      </div>

      {!myResponse && !revealed && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2">
            {palette.map((c) => (
              <button
                key={c.id}
                data-testid={`cp-color-${c.id}`}
                onClick={() => setSelectedColor(c)}
                title={c.label}
                className={`aspect-square rounded-xl border-2 transition-all ${
                  selectedColor?.id === c.id
                    ? "border-gray-800 scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          {selectedColor && (
            <div
              data-testid="cp-selected-color"
              className="flex items-center gap-2 p-2 rounded-xl border border-gray-200"
            >
              <div
                className="w-6 h-6 rounded-full border border-white shadow"
                style={{ backgroundColor: selectedColor.hex }}
              />
              <span className="text-sm font-semibold text-gray-700">{selectedColor.label}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <input
              data-testid="cp-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="（選填）一句話說說為何選這個顏色…"
              maxLength={maxNoteLength + 5}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {note.length > maxNoteLength && (
              <p data-testid="cp-note-error" className="text-xs text-red-500 text-center">
                說明最多 {maxNoteLength} 字
              </p>
            )}
          </div>

          <button
            data-testid="cp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的色彩心情
          </button>
        </div>
      )}

      {myResponse && !revealed && (
        <div data-testid="cp-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <div
            className="w-10 h-10 rounded-full mx-auto mb-2 shadow"
            style={{ backgroundColor: myResponse.colorHex }}
          />
          <p className="text-sm font-semibold text-gray-700">{myResponse.colorLabel}</p>
          {myResponse.note && <p className="text-xs text-gray-500 mt-1">{myResponse.note}</p>}
          <p className="text-green-700 font-semibold text-sm mt-2">✅ 已送出！等待揭曉</p>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="cp-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉色彩心情牆
        </button>
      ) : (
        <div data-testid="cp-result" className="flex flex-col gap-3">
          {responses.length === 0 ? (
            <div data-testid="cp-empty" className="text-center text-gray-400 p-8">
              還沒有人選色
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center p-4 bg-gray-50 rounded-xl">
                {responses.map((r) => (
                  <div
                    key={r.responseId}
                    data-testid={`cp-dot-${r.responseId}`}
                    title={showAuthor ? `${r.userName}：${r.colorLabel}` : r.colorLabel}
                    className="w-8 h-8 rounded-full shadow border-2 border-white"
                    style={{ backgroundColor: r.colorHex }}
                  />
                ))}
              </div>

              {colorGroups.length > 0 && (
                <div className="flex flex-col gap-1">
                  {colorGroups
                    .sort((a, b) => b.count - a.count)
                    .map(({ color, count }) => (
                      <div key={color.id} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            data-testid={`cp-bar-${color.id}`}
                            className="h-2 rounded-full"
                            style={{
                              backgroundColor: color.hex,
                              width: `${(count / responses.length) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-2">
                {responses.map((r) => {
                  const hearted = r.hearts.includes(myUserId);
                  return (
                    <div
                      key={r.responseId}
                      data-testid={`cp-card-${r.responseId}`}
                      className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 shadow"
                        style={{ backgroundColor: r.colorHex }}
                      />
                      <div className="flex-1 min-w-0">
                        {showAuthor && (
                          <p className="text-xs text-gray-500 font-semibold">{r.userName}</p>
                        )}
                        <p className="text-sm font-bold text-gray-700">{r.colorLabel}</p>
                        {r.note && (
                          <p
                            data-testid={`cp-card-note-${r.responseId}`}
                            className="text-xs text-gray-500 mt-0.5"
                          >
                            {r.note}
                          </p>
                        )}
                      </div>
                      <button
                        data-testid={`cp-heart-${r.responseId}`}
                        onClick={() => onHeart(r.responseId)}
                        className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                          hearted ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                        }`}
                      >
                        {hearted ? "❤️" : "🤍"}
                        <span data-testid={`cp-heart-count-${r.responseId}`}>
                          {r.hearts.length}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
