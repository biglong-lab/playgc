import { useState, useRef } from "react";

export interface MoodPosition extends Record<string, unknown> {
  posId: string;
  userId: string;
  userName: string;
  x: number;
  y: number;
}

export interface MoodMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  xLow: string;
  xHigh: string;
  yLow: string;
  yHigh: string;
}

export interface MoodMapState extends Record<string, unknown> {
  positions: MoodPosition[];
  revealed: boolean;
}

const DEFAULT_CONFIG: MoodMapConfig = {
  title: "心情地圖",
  prompt: "點擊地圖放置你的心情座標",
  xLow: "低能量",
  xHigh: "高能量",
  yLow: "負面",
  yHigh: "正面",
};

interface Props {
  config: MoodMapConfig;
  state: MoodMapState;
  myUserId: string;
  onPlace: (x: number, y: number) => void;
  onReveal: () => void;
}

const QUADRANT_COLORS = [
  "bg-blue-100",
  "bg-green-100",
  "bg-red-100",
  "bg-yellow-100",
];

export default function MoodMap({
  config,
  state,
  myUserId,
  onPlace,
  onReveal,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [localPos, setLocalPos] = useState<{ x: number; y: number } | null>(null);

  const { positions, revealed } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const prompt = config.prompt || DEFAULT_CONFIG.prompt;
  const xLow = config.xLow || DEFAULT_CONFIG.xLow;
  const xHigh = config.xHigh || DEFAULT_CONFIG.xHigh;
  const yLow = config.yLow || DEFAULT_CONFIG.yLow;
  const yHigh = config.yHigh || DEFAULT_CONFIG.yHigh;

  const myPosition = positions.find((p) => p.userId === myUserId);

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (myPosition) return;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
    const cx = Math.max(0, Math.min(100, x));
    const cy = Math.max(0, Math.min(100, y));
    setLocalPos({ x: cx, y: cy });
  }

  function handleConfirm() {
    if (!localPos) return;
    onPlace(localPos.x, localPos.y);
    setLocalPos(null);
  }

  const displayPositions = revealed ? positions : myPosition ? [myPosition] : [];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="mm-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="mm-prompt"
        className="text-sm text-center text-gray-500"
      >
        {prompt}
      </p>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span></span>
          <span data-testid="mm-y-high" className="font-medium">
            ↑ {yHigh}
          </span>
          <span></span>
        </div>
        <div
          ref={mapRef}
          data-testid="mm-map"
          onClick={handleMapClick}
          className={`relative w-full h-64 border-2 rounded-xl overflow-hidden ${
            myPosition ? "cursor-default" : "cursor-crosshair"
          }`}
        >
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-30">
            {QUADRANT_COLORS.map((c, i) => (
              <div key={i} className={c} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-px bg-gray-300" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-full w-px bg-gray-300" />
          </div>

          {localPos && (
            <div
              data-testid="mm-preview-dot"
              className="absolute w-4 h-4 rounded-full bg-violet-400 border-2 border-violet-600 -translate-x-2 -translate-y-2 opacity-70"
              style={{ left: `${localPos.x}%`, bottom: `${localPos.y}%` }}
            />
          )}

          {displayPositions.map((pos) => (
            <div
              key={pos.posId}
              data-testid={`mm-dot-${pos.userId}`}
              title={pos.userName}
              className={`absolute w-5 h-5 rounded-full -translate-x-2.5 -translate-y-2.5 border-2 flex items-center justify-center text-xs font-bold ${
                pos.userId === myUserId
                  ? "bg-violet-500 border-violet-700 text-white"
                  : "bg-pink-400 border-pink-600 text-white"
              }`}
              style={{ left: `${pos.x}%`, bottom: `${pos.y}%` }}
            >
              {pos.userName.charAt(0)}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span data-testid="mm-x-low">← {xLow}</span>
          <span data-testid="mm-y-low">↓ {yLow}</span>
          <span data-testid="mm-x-high">{xHigh} →</span>
        </div>
      </div>

      {!myPosition && localPos && (
        <div className="flex gap-2 justify-center">
          <button
            data-testid="mm-confirm-btn"
            onClick={handleConfirm}
            className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
          >
            確認位置
          </button>
          <button
            data-testid="mm-cancel-btn"
            onClick={() => setLocalPos(null)}
            className="px-4 py-2 text-gray-500 border border-gray-200 rounded-lg text-sm hover:border-gray-300"
          >
            取消
          </button>
        </div>
      )}

      {myPosition && (
        <p data-testid="mm-my-pos" className="text-center text-xs text-gray-500">
          ✅ 已標記位置 ({myPosition.x}, {myPosition.y})
        </p>
      )}

      <p className="text-xs text-center text-gray-400">
        已有 <span data-testid="mm-count">{positions.length}</span> 人標記
      </p>

      {!revealed && (
        <div className="text-center">
          <button
            data-testid="mm-reveal-btn"
            onClick={onReveal}
            className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
          >
            公布所有位置
          </button>
        </div>
      )}

      {revealed && positions.length > 0 && (
        <p
          data-testid="mm-revealed-count"
          className="text-center text-sm text-violet-600 font-medium"
        >
          共 {positions.length} 人的心情地圖
        </p>
      )}
    </div>
  );
}
