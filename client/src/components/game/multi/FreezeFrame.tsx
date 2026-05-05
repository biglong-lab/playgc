import { useState } from "react";

export interface FrameEntry extends Record<string, unknown> {
  frameId: string;
  userId: string;
  userName: string;
  text: string;
  status: "green" | "yellow" | "red";
}

export interface FreezeFrameConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface FreezeFrameState extends Record<string, unknown> {
  frames: FrameEntry[];
  revealed: boolean;
}

const DEFAULT_CONFIG: FreezeFrameConfig = {
  title: "現況快照",
  prompt: "你現在在做什麼？進度如何？",
  maxLength: 80,
};

const STATUS_CONFIG = {
  green: { label: "🟢 順利", bg: "bg-green-50 border-green-200", text: "text-green-700" },
  yellow: { label: "🟡 有挑戰", bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700" },
  red: { label: "🔴 需要幫助", bg: "bg-red-50 border-red-200", text: "text-red-700" },
};

interface Props {
  config: FreezeFrameConfig;
  state: FreezeFrameState;
  myUserId: string;
  onSubmit: (text: string, status: "green" | "yellow" | "red") => void;
  onReveal: () => void;
}

export default function FreezeFrame({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [input, setInput] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"green" | "yellow" | "red">("green");

  const { title, prompt, maxLength } = config || DEFAULT_CONFIG;
  const { frames, revealed } = state;
  const myFrame = frames.find((f) => f.userId === myUserId);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed, selectedStatus);
    setInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="ff-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="ff-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myFrame ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {(["green", "yellow", "red"] as const).map((s) => (
                  <button
                    key={s}
                    data-testid={`ff-status-${s}`}
                    onClick={() => setSelectedStatus(s)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      selectedStatus === s
                        ? STATUS_CONFIG[s].bg + " " + STATUS_CONFIG[s].text + " ring-2 ring-offset-1 ring-current"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <textarea
                  data-testid="ff-input"
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= maxLength) setInput(e.target.value);
                  }}
                  placeholder="簡短描述你的現況..."
                  rows={2}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none pr-12"
                />
                <span className="absolute right-3 bottom-2 text-xs text-gray-400">
                  {input.length}/{maxLength}
                </span>
              </div>
              <button
                data-testid="ff-submit-btn"
                onClick={handleSubmit}
                disabled={input.trim().length === 0}
                className="w-full py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-40"
              >
                送出現況
              </button>
            </div>
          ) : (
            <div
              data-testid="ff-my-frame"
              className={`p-3 border rounded-xl ${STATUS_CONFIG[myFrame.status].bg}`}
            >
              <p className={`text-xs font-semibold mb-1 ${STATUS_CONFIG[myFrame.status].text}`}>
                ✅ {STATUS_CONFIG[myFrame.status].label}
              </p>
              <p className="text-sm text-gray-700">{myFrame.text}</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="ff-count">{frames.length}</span> 人回報
          </p>

          <div className="text-center">
            <button
              data-testid="ff-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布所有現況
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="ff-result" className="space-y-2">
          {frames.length === 0 ? (
            <div data-testid="ff-empty" className="text-center text-gray-400 py-8">
              尚無人回報
            </div>
          ) : (
            <>
              {(["green", "yellow", "red"] as const).map((s) => {
                const group = frames.filter((f) => f.status === s);
                if (group.length === 0) return null;
                return (
                  <div key={s} data-testid={`ff-group-${s}`}>
                    <p className={`text-xs font-semibold mb-1 ${STATUS_CONFIG[s].text}`}>
                      {STATUS_CONFIG[s].label}（{group.length}）
                    </p>
                    <div className="space-y-1">
                      {group.map((f) => (
                        <div
                          key={f.frameId}
                          data-testid={`ff-frame-${f.frameId}`}
                          className={`p-2 border rounded-lg text-sm ${STATUS_CONFIG[s].bg}`}
                        >
                          <span className="font-medium">{f.userName}：</span>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
