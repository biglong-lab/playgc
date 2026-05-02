// 🎯 LotteryWheel — HostScreen 轉盤抽獎元件（W18 D1）
//
// 設計依據：docs/decisions/0013-w18-component-expansion.md
// pageType: host_lottery_wheel
//
// 玩法：
//   - 大螢幕：圓盤 N 等分（每等分一個項目）→ admin 啟動旋轉 → 減速停在中獎者
//   - 玩家端：報名（送名字）+ 看自己中獎結果
//   - 適用：婚禮抽伴娘、生日抽禮物、園遊會抽獎、企業福委會抽獎、派對遊戲
//
// state 結構：
//   {
//     items: { id, label }[];      // 候選池（含玩家報名）
//     spinning: boolean;
//     winnerId: string | null;     // 旋轉結束時設
//     spinStartedAt: number | null;
//     spinDurationMs: number;
//   }
//
// pulse 結構：
//   { type: "join", payload: { name } }       // 玩家報名
//   { type: "spin", payload: {} }              // admin 觸發旋轉（管理介面 W18+ 補）
//   { type: "result", payload: { winnerId } } // 結束、廣播中獎者

import { useEffect, useMemo, useState } from "react";

const DEFAULT_SPIN_DURATION_MS = 5000;
const MAX_ITEMS = 30; // 圓盤等分上限（更多會看不清）

export interface LotteryWheelItem {
  id: string;
  label: string;
}

export interface LotteryWheelConfig {
  /** 標題（大螢幕）*/
  title?: string;
  /** 副標 */
  subtitle?: string;
  /** 預設候選池（admin 設定）*/
  items?: LotteryWheelItem[];
  /** 旋轉時長（毫秒，預設 5000）*/
  spinDurationMs?: number;
  /** 是否允許玩家報名加入候選（預設 true）*/
  allowJoin?: boolean;
}

export interface LotteryWheelState {
  items: LotteryWheelItem[];
  spinning: boolean;
  winnerId: string | null;
  spinStartedAt: number | null;
  spinDurationMs: number;
}

export interface LotteryWheelProps {
  config: LotteryWheelConfig;
  hostMode: boolean;
  state?: LotteryWheelState | null;
  onPulse?: (pulseType: string, payload: { name?: string; winnerId?: string }) => void;
  onBroadcastState?: (state: LotteryWheelState) => void;
}

export function buildInitialLotteryState(config: LotteryWheelConfig): LotteryWheelState {
  return {
    items: (config.items ?? []).slice(0, MAX_ITEMS),
    spinning: false,
    winnerId: null,
    spinStartedAt: null,
    spinDurationMs: config.spinDurationMs ?? DEFAULT_SPIN_DURATION_MS,
  };
}

/**
 * 計算當前角度（CSS rotate 用）
 *
 * 旋轉軌跡：
 *   - 0 ~ duration*0.7：等速 360° × N 圈
 *   - duration*0.7 ~ duration：減速到目標角度
 */
export function calculateWheelAngle(
  startedAt: number | null,
  durationMs: number,
  targetIndex: number | null,
  totalItems: number,
  now: number,
): number {
  if (!startedAt || totalItems === 0) return 0;
  const elapsed = now - startedAt;
  if (elapsed >= durationMs) {
    if (targetIndex === null) return 0;
    const segmentAngle = 360 / totalItems;
    return -targetIndex * segmentAngle - segmentAngle / 2 + 360 * 5;
  }
  const progress = elapsed / durationMs;
  const easeOut = 1 - Math.pow(1 - progress, 3); // ease-out cubic
  const totalRotation = 360 * 5 + (targetIndex !== null ? -targetIndex * (360 / totalItems) : 0);
  return totalRotation * easeOut;
}

export default function LotteryWheel({ config, hostMode, state, onPulse }: LotteryWheelProps) {
  const effectiveState = state ?? buildInitialLotteryState(config);
  const items = effectiveState.items;
  const totalItems = items.length;

  // 動畫 tick
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hostMode || !effectiveState.spinning) return;
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [hostMode, effectiveState.spinning]);

  const winnerIndex = useMemo(() => {
    if (!effectiveState.winnerId) return null;
    const idx = items.findIndex((i) => i.id === effectiveState.winnerId);
    return idx >= 0 ? idx : null;
  }, [items, effectiveState.winnerId]);

  const angle = calculateWheelAngle(
    effectiveState.spinStartedAt,
    effectiveState.spinDurationMs,
    winnerIndex,
    totalItems,
    now,
  );

  const isFinished =
    effectiveState.spinStartedAt !== null &&
    now - effectiveState.spinStartedAt >= effectiveState.spinDurationMs &&
    !!effectiveState.winnerId;

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 text-zinc-900">
        <div className="relative z-10 flex flex-col items-center justify-center h-screen px-8">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-center mb-2">
            🎯 {config.title ?? "轉盤抽獎"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-600 text-center mb-6">
              {config.subtitle}
            </p>
          )}

          {totalItems === 0 ? (
            <div className="text-2xl text-zinc-500 mt-12">
              {config.allowJoin === false ? "尚未設定候選項目" : "等待玩家報名加入..."}
            </div>
          ) : (
            <>
              {/* 轉盤本體 */}
              <div className="relative" style={{ width: "min(80vmin, 600px)", height: "min(80vmin, 600px)" }}>
                {/* 指針（固定在頂部） */}
                <div
                  className="absolute z-20 -top-2 left-1/2 -translate-x-1/2"
                  style={{ borderLeft: "20px solid transparent", borderRight: "20px solid transparent", borderTop: "40px solid #ef4444" }}
                  data-testid="lottery-pointer"
                />

                {/* 旋轉圓盤 */}
                <div
                  className="absolute inset-0 rounded-full shadow-2xl border-4 border-amber-600"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transition: effectiveState.spinning ? "none" : "transform 0.5s ease-out",
                  }}
                  data-testid="lottery-wheel"
                >
                  {items.map((item, idx) => {
                    const segAngle = 360 / totalItems;
                    const startAngle = idx * segAngle;
                    const colors = ["#fcd34d", "#fb923c", "#f87171", "#c084fc", "#60a5fa", "#34d399"];
                    const color = colors[idx % colors.length];
                    return (
                      <div
                        key={item.id}
                        className="absolute inset-0 rounded-full"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(((startAngle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin(((startAngle - 90) * Math.PI) / 180)}%, ${50 + 50 * Math.cos(((startAngle + segAngle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin(((startAngle + segAngle - 90) * Math.PI) / 180)}%)`,
                          background: color,
                        }}
                      >
                        <div
                          className="absolute text-zinc-900 font-bold text-lg md:text-2xl text-center"
                          style={{
                            left: "50%",
                            top: "50%",
                            transform: `rotate(${startAngle + segAngle / 2}deg) translateY(-${30 + (totalItems > 12 ? 0 : 5)}vmin)`,
                            transformOrigin: "0 0",
                            width: "100px",
                            marginLeft: "-50px",
                          }}
                        >
                          {item.label}
                        </div>
                      </div>
                    );
                  })}
                  {/* 中心圓 */}
                  <div className="absolute left-1/2 top-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600 shadow-inner flex items-center justify-center text-white font-bold text-xl">
                    🎯
                  </div>
                </div>
              </div>

              {/* 中獎結果 */}
              {isFinished && winnerIndex !== null && (
                <div
                  className="mt-8 px-12 py-6 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl shadow-xl border-4 border-amber-700"
                  data-testid="lottery-winner"
                >
                  <div className="text-2xl text-amber-900">🎉 恭喜中獎</div>
                  <div className="text-5xl md:text-6xl font-bold text-amber-900 mt-2">
                    {items[winnerIndex].label}
                  </div>
                </div>
              )}

              {/* 計數 + 候選 */}
              {!isFinished && (
                <div className="mt-6 text-center text-zinc-600">
                  共 <span className="font-bold text-amber-700 text-2xl">{totalItems}</span> 個候選
                  {effectiveState.spinning && <div className="text-base mt-1">🌀 旋轉中...</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  const winnerItem = winnerIndex !== null ? items[winnerIndex] : null;
  const playerName = (typeof window !== "undefined" && localStorage.getItem("chitoUserName")) || "";

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">🎯 {config.title ?? "轉盤抽獎"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 報名 */}
      {config.allowJoin !== false && !effectiveState.spinning && !isFinished && (
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">大螢幕轉盤候選人</p>
          <button
            type="button"
            onClick={() => {
              if (!playerName) {
                alert("請先設定玩家名稱");
                return;
              }
              onPulse?.("join", { name: playerName });
            }}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md hover:bg-amber-600 transition-all"
            data-testid="btn-lottery-join"
          >
            🙋 加入抽獎（{playerName || "未設定"}）
          </button>
          <div className="text-xs text-muted-foreground">
            目前候選：{totalItems} 人
          </div>
        </div>
      )}

      {/* 旋轉中 */}
      {effectiveState.spinning && !isFinished && (
        <div className="text-center py-8">
          <div className="text-6xl animate-spin">🎯</div>
          <p className="text-base mt-3 text-muted-foreground">大螢幕轉盤旋轉中...</p>
        </div>
      )}

      {/* 中獎結果（玩家端）*/}
      {isFinished && winnerItem && (
        <div className="text-center py-8 space-y-2">
          {winnerItem.label === playerName ? (
            <div className="space-y-3">
              <div className="text-7xl">🎉</div>
              <div className="text-2xl font-bold text-amber-700">恭喜您中獎！</div>
              <div className="text-base text-muted-foreground">向活動主辦人領取獎品</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">😢</div>
              <div className="text-base text-muted-foreground">
                這次中獎是 <span className="font-bold">{winnerItem.label}</span>
              </div>
              <div className="text-sm text-muted-foreground">下次再來吧！</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
