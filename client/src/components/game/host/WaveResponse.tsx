// 📺 WaveResponse — HostScreen 人浪應援元件（W3 D2，S 級）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_wave_response
//
// 玩法：
//   - 玩家連點「應援」大按鈕
//   - 大螢幕呈現「即時應援強度」（最近 5 秒每秒點擊次數折線/長條）+ 總點擊數
//   - 適用：演唱會、運動賽事、開幕熱場、應援賽
//
// state 結構：
//   {
//     totalTaps: number;
//     bucketBySec: Record<secondTimestamp, number>; // 每秒 bucket，保留最近 30 秒
//   }
//
// pulse: { type: "tap" }（無 payload）

import { useEffect, useState, useRef, useCallback } from "react";

export interface WaveResponseConfig {
  title?: string;
  subtitle?: string;
  /** 大按鈕文字 */
  buttonLabel?: string;
}

interface WaveResponseState {
  totalTaps: number;
  bucketBySec: Record<string, number>; // key = floor(now/1000)
}

export interface WaveResponseProps {
  config: WaveResponseConfig;
  hostMode: boolean;
  state?: WaveResponseState | null;
  onPulse?: (pulseType: string, payload: Record<string, never>) => void;
  onBroadcastState?: (state: WaveResponseState) => void;
}

const PLAYER_THROTTLE_MS = 80; // 每 80ms 一次（避免 ws 塞爆）
const BUCKET_WINDOW_SEC = 30;  // 大螢幕顯示最近 30 秒

function buildInitialState(): WaveResponseState {
  return { totalTaps: 0, bucketBySec: {} };
}

export default function WaveResponse({ config, hostMode, state, onPulse }: WaveResponseProps) {
  const effectiveState = state ?? buildInitialState();
  const lastClickRef = useRef<number>(0);
  const [now, setNow] = useState(Date.now());

  // hostMode 動畫 tick（每 100ms 重繪、計算當前秒 bucket）
  useEffect(() => {
    if (!hostMode) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [hostMode]);

  // 玩家 throttle
  const handleTap = useCallback(() => {
    const t = Date.now();
    if (t - lastClickRef.current < PLAYER_THROTTLE_MS) return;
    lastClickRef.current = t;
    onPulse?.("tap", {});
  }, [onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const currentSec = Math.floor(now / 1000);
    // 最近 30 秒 bucket，從舊到新
    const buckets: { sec: number; count: number }[] = [];
    for (let i = BUCKET_WINDOW_SEC - 1; i >= 0; i--) {
      const sec = currentSec - i;
      buckets.push({ sec, count: effectiveState.bucketBySec[sec.toString()] ?? 0 });
    }
    const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
    const recentSum = buckets.slice(-5).reduce((s, b) => s + b.count, 0); // 最近 5 秒總和
    const intensity = Math.min(100, recentSum * 2); // 簡單映射 0-100

    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-white p-8">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-center mb-3">
          {config.title ?? "全場應援"}
        </h1>
        {config.subtitle && (
          <p className="text-base md:text-xl text-zinc-400 text-center mb-8">{config.subtitle}</p>
        )}

        {/* 中央脈動圈 + 強度 */}
        <div className="relative my-8">
          <div
            className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-2xl"
            style={{
              transform: `scale(${1 + intensity / 200})`,
              transition: "transform 200ms ease-out",
              boxShadow: `0 0 ${intensity}px rgba(236, 72, 153, 0.6)`,
            }}
          >
            <div className="text-center">
              <div className="text-6xl md:text-7xl font-bold">{recentSum}</div>
              <div className="text-sm text-white/80 mt-1">最近 5 秒</div>
            </div>
          </div>
          {/* 漣漪 */}
          {intensity > 30 && (
            <div className="absolute inset-0 rounded-full border-4 border-pink-400 animate-ping pointer-events-none" />
          )}
        </div>

        {/* 總點擊 */}
        <div className="text-center mb-8">
          <span className="text-6xl font-bold text-primary">{effectiveState.totalTaps}</span>
          <span className="text-lg text-zinc-400 ml-2">總應援數</span>
        </div>

        {/* 30 秒長條圖 */}
        <div className="w-full max-w-3xl">
          <p className="text-xs text-zinc-500 mb-2 text-center">最近 30 秒應援強度</p>
          <div className="flex items-end gap-1 h-24">
            {buckets.map((b, i) => {
              const h = (b.count / maxBucket) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-pink-500 to-orange-400 rounded-t transition-all duration-300"
                  style={{ height: `${h}%`, minHeight: "2px" }}
                  title={`${b.count} taps`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "現場應援"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 巨型應援按鈕 */}
      <button
        type="button"
        onClick={handleTap}
        className="w-full aspect-square rounded-full bg-gradient-to-br from-pink-500 to-orange-500 hover:from-pink-400 hover:to-orange-400 active:scale-95 transition-all flex items-center justify-center text-white shadow-2xl"
        data-testid="btn-wave-tap"
      >
        <div className="text-center">
          <div className="text-7xl mb-2">📣</div>
          <div className="text-2xl font-bold">{config.buttonLabel ?? "應援！"}</div>
          <div className="text-xs text-white/70 mt-2">連點越快、聲量越大</div>
        </div>
      </button>

      <p className="text-xs text-center text-muted-foreground">
        💡 看大螢幕脈動感受全場熱情
      </p>
    </div>
  );
}
