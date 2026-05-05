import React from "react";

export interface PresenceMapConfig {
  title: string;
  xAxisLeft: string;
  xAxisRight: string;
  yAxisTop: string;
  yAxisBottom: string;
  showNames: boolean;
}

export interface PresenceDot {
  userId: string;
  userName: string;
  x: number; // 0–100
  y: number; // 0–100
}

export interface PresenceMapState extends Record<string, unknown> {
  dots: PresenceDot[];
}

interface Props {
  config: PresenceMapConfig;
  state: PresenceMapState;
  myUserId: string;
  localDot: { x: number; y: number } | null;
  onCanvasClick: (x: number, y: number) => void;
  onConfirm: () => void;
}

export default function PresenceMap({ config, state, myUserId, localDot, onCanvasClick, onConfirm }: Props) {
  const { title, xAxisLeft, xAxisRight, yAxisTop, yAxisBottom, showNames } = config;
  const { dots } = state;

  const myConfirmedDot = dots.find((d) => d.userId === myUserId);
  const hasConfirmed = !!myConfirmedDot;
  const hasLocalDot = localDot !== null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasConfirmed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.width > 0 ? Math.round(((e.clientX - rect.left) / rect.width) * 100) : 50;
    const y = rect.height > 0 ? Math.round(((e.clientY - rect.top) / rect.height) * 100) : 50;
    onCanvasClick(x, y);
  };

  return (
    <div data-testid="pm-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="pm-title" className="text-lg font-bold text-center">{title}</h2>

      <div className="relative">
        <p data-testid="pm-y-top" className="text-xs text-center text-gray-500 mb-1">{yAxisTop}</p>

        <div className="flex items-center gap-2">
          <p data-testid="pm-x-left" className="text-xs text-gray-500 w-10 text-right flex-shrink-0">{xAxisLeft}</p>

          <div
            data-testid="pm-canvas"
            onClick={handleClick}
            className={[
              "relative flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl aspect-square",
              hasConfirmed ? "cursor-not-allowed" : "cursor-crosshair hover:border-purple-300",
            ].join(" ")}
          >
            {/* 中心十字線 */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 pointer-events-none" />

            {/* 已確認的標記點 */}
            {dots.map((dot) => (
              <div
                key={dot.userId}
                data-testid={`pm-dot-${dot.userId}`}
                className={[
                  "absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all",
                  dot.userId === myUserId
                    ? "bg-purple-500 ring-2 ring-white shadow-lg z-10"
                    : "bg-blue-400 opacity-80",
                ].join(" ")}
                style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              >
                {showNames && (
                  <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap bg-white/90 px-1 rounded shadow-sm pointer-events-none">
                    {dot.userName}
                  </span>
                )}
              </div>
            ))}

            {/* 本地預覽點（尚未確認） */}
            {hasLocalDot && !hasConfirmed && (
              <div
                data-testid="pm-local-dot"
                className="absolute w-4 h-4 rounded-full bg-purple-300 ring-2 ring-purple-500 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse z-20"
                style={{ left: `${localDot!.x}%`, top: `${localDot!.y}%` }}
              />
            )}
          </div>

          <p data-testid="pm-x-right" className="text-xs text-gray-500 w-10 flex-shrink-0">{xAxisRight}</p>
        </div>

        <p data-testid="pm-y-bottom" className="text-xs text-center text-gray-500 mt-1">{yAxisBottom}</p>
      </div>

      {/* 尚未放置時的提示 */}
      {!hasLocalDot && !hasConfirmed && (
        <p data-testid="pm-hint" className="text-xs text-gray-400 text-center">
          點擊圖上任意位置放置你的標記
        </p>
      )}

      {/* 放置後尚未確認的提示 */}
      {hasLocalDot && !hasConfirmed && (
        <p data-testid="pm-preview-hint" className="text-xs text-gray-400 text-center">
          按「確認」鎖定你的位置
        </p>
      )}

      {/* 確認按鈕 */}
      {hasLocalDot && !hasConfirmed && (
        <button
          data-testid="pm-confirm-btn"
          onClick={onConfirm}
          className="w-full py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-colors"
        >
          確認我的位置
        </button>
      )}

      {/* 已確認訊息 */}
      {hasConfirmed && (
        <p data-testid="pm-placed-msg" className="text-center text-green-600 font-semibold text-sm">
          ✅ 已確認位置
        </p>
      )}

      <div className="text-xs text-gray-400 text-center">
        <span data-testid="pm-count">{dots.length}</span> 人已標記位置
      </div>
    </div>
  );
}
