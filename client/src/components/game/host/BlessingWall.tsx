// 📺 BlessingWall — HostScreen 祝福瀑布牆元件（W22 D2，交誼類主視覺）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md
// pageType: host_blessing_wall
//
// 玩法：
//   - 大螢幕：祝福訊息從底部冒出、漂浮 8 秒消失、配 emoji 飄落
//   - 玩家端：簡單表單（名字 + 祝福語 + emoji 選 1）送出後上牆
//   - 適用：婚禮主視覺、生日壽星祝福、同學會重逢、頒獎得主應援
//   - 跟 GuestbookDigital 互補：靜態 vs 動態瀑布
//
// state 結構：
//   {
//     blessings: BlessingItem[];       // 累計（最多 100 個）
//     recentFlying: FlyingBlessing[];  // 飛翔中（最多 30 個）
//   }
//
// pulse 結構：
//   { type: "blessing", payload: { name, message, emoji? } }

import { useEffect, useRef, useState, useCallback } from "react";

const FLY_DURATION_MS = 8000;
const PLAYER_THROTTLE_MS = 3000;
const DEFAULT_EMOJIS = ["💕", "🎉", "✨", "💝", "🎂", "🌟", "🥂", "🎊"];

export interface BlessingItem {
  id: string;
  name: string;
  message: string;
  emoji?: string;
  addedAt: number;
}

export interface FlyingBlessing extends BlessingItem {
  x: number; // 0-100 %
  startedAt: number;
}

export interface BlessingWallConfig {
  /** 標題 */
  title?: string;
  /** 副標 */
  subtitle?: string;
  /** 主題（婚禮 / 生日 / 同學會 / 頒獎）*/
  theme?: "wedding" | "birthday" | "reunion" | "awards" | "default";
  /** 可選 emoji 集 */
  emojis?: string[];
  /** 字數上限（預設 30）*/
  maxLength?: number;
}

export interface BlessingWallState {
  blessings: BlessingItem[];
  recentFlying: FlyingBlessing[];
}

export interface BlessingWallProps {
  config: BlessingWallConfig;
  hostMode: boolean;
  state?: BlessingWallState | null;
  onPulse?: (pulseType: string, payload: { name: string; message: string; emoji?: string }) => void;
  onBroadcastState?: (state: BlessingWallState) => void;
}

const THEME_STYLES: Record<NonNullable<BlessingWallConfig["theme"]>, { bg: string; card: string; title: string }> = {
  wedding: {
    bg: "bg-gradient-to-br from-rose-100 via-pink-100 to-fuchsia-100 dark:from-rose-950/40 dark:via-pink-950/40 dark:to-fuchsia-950/40",
    card: "bg-white/80 dark:bg-zinc-900/70 border-rose-200 dark:border-rose-800/50",
    title: "text-rose-900 dark:text-rose-100",
  },
  birthday: {
    bg: "bg-gradient-to-br from-yellow-100 via-orange-100 to-pink-100 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-pink-950/40",
    card: "bg-white/80 dark:bg-zinc-900/70 border-amber-200 dark:border-amber-800/50",
    title: "text-amber-900 dark:text-amber-100",
  },
  reunion: {
    bg: "bg-gradient-to-br from-purple-100 via-indigo-100 to-blue-100 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-blue-950/40",
    card: "bg-white/80 dark:bg-zinc-900/70 border-purple-200 dark:border-purple-800/50",
    title: "text-purple-900 dark:text-purple-100",
  },
  awards: {
    bg: "bg-gradient-to-br from-yellow-100 via-amber-100 to-orange-100 dark:from-yellow-950/40 dark:via-amber-950/40 dark:to-orange-950/40",
    card: "bg-white/80 dark:bg-zinc-900/70 border-yellow-300 dark:border-yellow-800/50",
    title: "text-amber-900 dark:text-amber-100",
  },
  default: {
    bg: "bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-950 dark:to-zinc-900",
    card: "bg-white/80 dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-700",
    title: "text-zinc-900 dark:text-zinc-100",
  },
};

function buildInitialState(): BlessingWallState {
  return { blessings: [], recentFlying: [] };
}

export default function BlessingWall({ config, hostMode, state, onPulse }: BlessingWallProps) {
  const theme = THEME_STYLES[config.theme ?? "default"];
  const emojis = config.emojis ?? DEFAULT_EMOJIS;
  const maxLength = config.maxLength ?? 30;
  const effectiveState = state ?? buildInitialState();
  const lastSubmitRef = useRef<number>(0);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string>(emojis[0] ?? "");
  const [submitted, setSubmitted] = useState(false);

  // 大螢幕端動畫 tick
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hostMode) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [hostMode]);

  const handleSubmit = useCallback(() => {
    const submitTime = Date.now();
    if (submitTime - lastSubmitRef.current < PLAYER_THROTTLE_MS) return;
    if (!name.trim() || !message.trim()) return;
    lastSubmitRef.current = submitTime;
    onPulse?.("blessing", {
      name: name.trim().slice(0, 20),
      message: message.trim().slice(0, maxLength),
      emoji: selectedEmoji,
    });
    setSubmitted(true);
    setMessage("");
    setTimeout(() => setSubmitted(false), 2000);
  }, [name, message, selectedEmoji, maxLength, onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const visibleFlying = effectiveState.recentFlying.filter((f) => now - f.startedAt < FLY_DURATION_MS);
    return (
      <div className={`w-full h-full min-h-screen relative overflow-hidden ${theme.bg}`}>
        {/* Header */}
        <div className="relative z-10 pt-8 px-6 text-center">
          <h1 className={`text-3xl md:text-5xl font-bold ${theme.title}`}>
            {config.title ?? "💝 祝福牆"}
          </h1>
          {config.subtitle && (
            <p className={`text-base md:text-xl mt-2 ${theme.title} opacity-80`}>{config.subtitle}</p>
          )}
          <p className={`mt-3 text-sm ${theme.title} opacity-60`}>
            收到 {effectiveState.blessings.length} 則祝福
          </p>
        </div>

        {/* 飛翔祝福層 */}
        <div className="absolute inset-x-0 bottom-0 top-32 pointer-events-none" data-testid="blessing-fly-layer">
          {visibleFlying.map((f) => {
            const elapsed = now - f.startedAt;
            const progress = elapsed / FLY_DURATION_MS;
            const yPercent = 100 - progress * 90;
            const opacity = progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) * 6.67 : 1;
            return (
              <div
                key={f.id}
                className="absolute"
                style={{
                  left: `${f.x}%`,
                  top: `${yPercent}%`,
                  transform: "translate(-50%, -50%)",
                  opacity,
                }}
              >
                <div className={`px-4 py-3 rounded-2xl shadow-lg border-2 max-w-xs ${theme.card}`}>
                  {f.emoji && <span className="text-2xl mr-1">{f.emoji}</span>}
                  <span className={`font-semibold ${theme.title}`}>{f.name}</span>
                  <p className={`text-sm mt-1 ${theme.title} opacity-90`}>{f.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── 玩家版型（手機）───
  return (
    <div className={`w-full min-h-screen p-4 ${theme.bg}`}>
      <div className="max-w-md mx-auto pt-6">
        <h1 className={`text-2xl font-bold text-center ${theme.title}`}>
          {config.title ?? "💝 留下祝福"}
        </h1>
        {config.subtitle && (
          <p className={`text-sm text-center mt-1 ${theme.title} opacity-70`}>{config.subtitle}</p>
        )}

        <div className={`mt-6 rounded-xl border-2 p-4 ${theme.card}`}>
          <label className="block">
            <span className={`text-sm font-medium ${theme.title}`}>你的名字</span>
            <input
              type="text"
              data-testid="blessing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="如何稱呼你？"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block mt-3">
            <span className={`text-sm font-medium ${theme.title}`}>祝福訊息（{message.length}/{maxLength}）</span>
            <textarea
              data-testid="blessing-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
              placeholder="寫一句話..."
              rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
            />
          </label>
          <div className="mt-3">
            <span className={`text-sm font-medium ${theme.title}`}>選個 emoji</span>
            <div className="grid grid-cols-8 gap-1 mt-1">
              {emojis.map((e) => (
                <button
                  key={e}
                  data-testid={`blessing-emoji-${e}`}
                  onClick={() => setSelectedEmoji(e)}
                  className={`text-2xl py-1 rounded transition-colors ${
                    selectedEmoji === e ? "bg-rose-200 dark:bg-rose-900/40 ring-2 ring-rose-400" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button
            data-testid="blessing-submit"
            onClick={handleSubmit}
            disabled={!name.trim() || !message.trim() || submitted}
            className="w-full mt-4 py-3 rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {submitted ? "✓ 已送出！" : "送出祝福"}
          </button>
        </div>
      </div>
    </div>
  );
}
