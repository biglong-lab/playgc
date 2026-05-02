// 📺 EmojiReact — HostScreen 全場 emoji 雨元件（W3 D1，S 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_emoji_react
//
// 玩法：
//   - 大螢幕：玩家點 emoji → 從底部往上飛 + 隨機水平擺動 + 累計各 emoji 計數
//   - 玩家端：8 個 emoji 按鈕，連點觸發 pulse（client throttle 每秒最多 5 次）
//   - 適用：演講即時情緒回饋、開幕熱場、現場應援
//
// state 結構：
//   {
//     counts: Record<emoji, number>;
//     totalReacts: number;
//     lastFlying: { emoji, x, id }[];  // 最近 N 個飛翔 emoji（給大螢幕渲染）
//   }
//
// pulse 結構：
//   { type: "react", payload: { emoji: "❤️" } }

import { useEffect, useState, useRef, useCallback } from "react";

const DEFAULT_EMOJIS = ["❤️", "👍", "🎉", "🔥", "😍", "👏", "😂", "🙌"];

export interface EmojiReactConfig {
  emojis?: string[];
  /** 標題（大螢幕）*/
  title?: string;
  /** 副標 */
  subtitle?: string;
  /** 大螢幕保留多少個飛翔 emoji（預設 50；太多會卡）*/
  maxFlyingOnScreen?: number;
}

interface FlyingEmoji {
  id: string;
  emoji: string;
  x: number; // 0-100 %
  startedAt: number;
}

interface EmojiReactState {
  counts: Record<string, number>;
  totalReacts: number;
  recentFlying: FlyingEmoji[];
}

export interface EmojiReactProps {
  config: EmojiReactConfig;
  hostMode: boolean;
  state?: EmojiReactState | null;
  onPulse?: (pulseType: string, payload: { emoji: string }) => void;
  onBroadcastState?: (state: EmojiReactState) => void;
}

const FLY_DURATION_MS = 4000;
const PLAYER_THROTTLE_MS = 200; // 每 200ms 最多 1 次

function buildInitialState(config: EmojiReactConfig): EmojiReactState {
  const emojis = config.emojis ?? DEFAULT_EMOJIS;
  return {
    counts: Object.fromEntries(emojis.map((e) => [e, 0])),
    totalReacts: 0,
    recentFlying: [],
  };
}

export default function EmojiReact({ config, hostMode, state, onPulse }: EmojiReactProps) {
  const emojis = config.emojis ?? DEFAULT_EMOJIS;
  const effectiveState = state ?? buildInitialState(config);
  const lastClickRef = useRef<number>(0);

  // hostMode：清理過期 flying（client side 動畫只看 startedAt 計算位置）
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hostMode) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [hostMode]);

  // 玩家端 throttle：避免狂點導致 ws 訊息塞爆
  const handleClick = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastClickRef.current < PLAYER_THROTTLE_MS) return;
    lastClickRef.current = now;
    onPulse?.("react", { emoji });
  }, [onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const visibleFlying = effectiveState.recentFlying.filter(
      (f) => now - f.startedAt < FLY_DURATION_MS,
    );
    return (
      <div className="w-full h-full min-h-screen relative overflow-hidden bg-gradient-to-b from-zinc-900 to-black text-white">
        {/* 飛翔 emoji 層 */}
        <div className="absolute inset-0 pointer-events-none">
          {visibleFlying.map((f) => {
            const elapsed = now - f.startedAt;
            const progress = elapsed / FLY_DURATION_MS;
            const yOffset = progress * 100; // 從底部往上 0%-100%
            const opacity = 1 - progress;
            const scale = 1 + Math.sin(progress * Math.PI) * 0.5; // 中段放大
            const wiggle = Math.sin(progress * 6 + parseInt(f.id, 36) % 7) * 5;
            return (
              <div
                key={f.id}
                className="absolute text-5xl md:text-7xl"
                style={{
                  left: `calc(${f.x}% + ${wiggle}vw)`,
                  bottom: `${yOffset}%`,
                  opacity,
                  transform: `scale(${scale})`,
                  transition: "none",
                }}
              >
                {f.emoji}
              </div>
            );
          })}
        </div>

        {/* 標題 + 計數 */}
        <div className="relative z-10 flex flex-col items-center justify-center h-screen px-8 pointer-events-none">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-center mb-3">
            {config.title ?? "現場互動"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-400 text-center mb-8">{config.subtitle}</p>
          )}

          <div className="text-center mb-8">
            <div className="text-7xl font-bold text-primary">{effectiveState.totalReacts}</div>
            <div className="text-sm text-zinc-400 mt-1">總互動數</div>
          </div>

          {/* 各 emoji 累計（橫排）*/}
          <div className="flex gap-4 md:gap-8 flex-wrap justify-center max-w-4xl">
            {emojis.map((emoji) => {
              const count = effectiveState.counts[emoji] ?? 0;
              return (
                <div key={emoji} className="text-center">
                  <div className="text-5xl md:text-6xl">{emoji}</div>
                  <div className="text-xl md:text-2xl font-bold text-primary mt-1">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "點擊送 emoji"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            className="aspect-square rounded-2xl bg-card border-2 border-border hover:border-primary/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-5xl"
            data-testid={`btn-emoji-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        💡 連點任一 emoji，大螢幕會即時飛起來
      </p>
    </div>
  );
}
