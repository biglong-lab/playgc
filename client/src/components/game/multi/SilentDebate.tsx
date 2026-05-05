import { useState } from "react";

export interface DebateArgument extends Record<string, unknown> {
  argId: string;
  userId: string;
  userName: string;
  side: "pro" | "con";
  text: string;
  hearts: string[];
}

export interface SilentDebateConfig extends Record<string, unknown> {
  title: string;
  topic: string;
  proLabel: string;
  conLabel: string;
  maxLength: number;
}

export interface SilentDebateState extends Record<string, unknown> {
  arguments: DebateArgument[];
  revealed: boolean;
}

const DEFAULT_CONFIG: SilentDebateConfig = {
  title: "靜默辯論",
  topic: "討論主題",
  proLabel: "正方",
  conLabel: "反方",
  maxLength: 100,
};

interface Props {
  config: SilentDebateConfig;
  state: SilentDebateState;
  myUserId: string;
  onSubmit: (side: "pro" | "con", text: string) => void;
  onReveal: () => void;
  onHeart: (argId: string) => void;
}

export default function SilentDebate({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const [selectedSide, setSelectedSide] = useState<"pro" | "con" | null>(null);
  const [text, setText] = useState("");

  const { arguments: args, revealed } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const topic = config.topic || DEFAULT_CONFIG.topic;
  const proLabel = config.proLabel || DEFAULT_CONFIG.proLabel;
  const conLabel = config.conLabel || DEFAULT_CONFIG.conLabel;
  const maxLength = config.maxLength ?? DEFAULT_CONFIG.maxLength;

  const myArg = args.find((a) => a.userId === myUserId);
  const proArgs = args.filter((a) => a.side === "pro");
  const conArgs = args.filter((a) => a.side === "con");

  function handleSubmit() {
    if (!selectedSide || text.trim() === "") return;
    onSubmit(selectedSide, text.trim());
    setText("");
    setSelectedSide(null);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="sd-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="sd-topic"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {topic}
      </p>

      {!revealed && (
        <div className="space-y-4">
          {!myArg ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  data-testid="sd-side-pro"
                  onClick={() => setSelectedSide("pro")}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    selectedSide === "pro"
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-500 hover:border-green-200"
                  }`}
                >
                  👍 {proLabel}
                </button>
                <button
                  data-testid="sd-side-con"
                  onClick={() => setSelectedSide("con")}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                    selectedSide === "con"
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-500 hover:border-red-200"
                  }`}
                >
                  👎 {conLabel}
                </button>
              </div>
              {selectedSide && (
                <div className="space-y-2">
                  <textarea
                    data-testid="sd-text-input"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                    placeholder={`輸入你的${selectedSide === "pro" ? proLabel : conLabel}論點...`}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {text.length}/{maxLength}
                    </span>
                    <button
                      data-testid="sd-submit-btn"
                      onClick={handleSubmit}
                      disabled={text.trim() === ""}
                      className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40"
                    >
                      提交
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p data-testid="sd-submitted" className="text-center text-sm text-gray-500">
              ✅ 已提交{myArg.side === "pro" ? proLabel : conLabel}論點
            </p>
          )}
          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="sd-count">{args.length}</span> 人提交（靜默中）
          </p>
          <div className="text-center">
            <button
              data-testid="sd-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布所有論點
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="space-y-4">
          {args.length === 0 ? (
            <div data-testid="sd-empty" className="text-center text-gray-400 py-8">
              尚無人提交論點
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 text-center">
                  👍 {proLabel}（{proArgs.length}）
                </p>
                {proArgs.length === 0 && (
                  <p className="text-xs text-gray-400 text-center">無人支持</p>
                )}
                {proArgs.map((arg) => (
                  <div
                    key={arg.argId}
                    data-testid={`sd-arg-${arg.argId}`}
                    className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs space-y-1"
                  >
                    <p className="font-medium text-green-700">{arg.userName}</p>
                    <p className="text-gray-700">{arg.text}</p>
                    <button
                      data-testid={`sd-heart-${arg.argId}`}
                      onClick={() => onHeart(arg.argId)}
                      className="text-xs text-gray-400 hover:text-red-400"
                    >
                      ❤️ {arg.hearts.length}
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-600 text-center">
                  👎 {conLabel}（{conArgs.length}）
                </p>
                {conArgs.length === 0 && (
                  <p className="text-xs text-gray-400 text-center">無人反對</p>
                )}
                {conArgs.map((arg) => (
                  <div
                    key={arg.argId}
                    data-testid={`sd-arg-${arg.argId}`}
                    className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1"
                  >
                    <p className="font-medium text-red-700">{arg.userName}</p>
                    <p className="text-gray-700">{arg.text}</p>
                    <button
                      data-testid={`sd-heart-${arg.argId}`}
                      onClick={() => onHeart(arg.argId)}
                      className="text-xs text-gray-400 hover:text-red-400"
                    >
                      ❤️ {arg.hearts.length}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
