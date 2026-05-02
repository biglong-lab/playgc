// 📺 PolaroidCollage — 拍立得紀念牆元件（Phase 2 W5 D1，紀念類首發、婚禮王牌）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_polaroid_collage
//
// 玩法：
//   - 玩家：輸入祝福語 + 選 emoji + 選色 → 送出
//   - 大螢幕：照片牆（拍立得風格、隨機旋轉角度、新卡片飄落動畫）
//   - 適用：婚禮派對、生日聚會、同學會、企業活動紀念
//
// state 結構：
//   {
//     polaroids: { id, emoji, message, author, color, ts }[];
//   }
//
// pulse: { type: "polaroid", payload: { emoji, message, color } }

import { useEffect, useState, useRef, useCallback, useMemo } from "react";

interface Polaroid {
  id: string;
  emoji: string;
  message: string;
  author: string;
  color: string;     // 卡背景色
  ts: number;
}

export interface PolaroidCollageConfig {
  title?: string;
  subtitle?: string;
  /** 大螢幕保留數量上限（預設 50）*/
  maxOnScreen?: number;
  /** 預設 emoji 選項 */
  emojis?: string[];
}

interface PolaroidCollageState {
  polaroids: Polaroid[];
}

export interface PolaroidCollageProps {
  config: PolaroidCollageConfig;
  hostMode: boolean;
  state?: PolaroidCollageState | null;
  myUserName?: string;
  onPulse?: (pulseType: string, payload: { emoji: string; message: string; color: string }) => void;
  onBroadcastState?: (state: PolaroidCollageState) => void;
}

const DEFAULT_EMOJIS = ["💖", "🎉", "🥂", "💍", "🌹", "🎂", "✨", "🎊", "💐", "🎁", "💑", "👰"];
const POLAROID_COLORS = [
  "#fef3c7", // 淡黃
  "#fce7f3", // 粉紅
  "#dbeafe", // 淡藍
  "#dcfce7", // 淡綠
  "#fef2f2", // 淡紅
  "#f5f3ff", // 淡紫
];

function buildInitialState(): PolaroidCollageState {
  return { polaroids: [] };
}

// hash → 旋轉角度（每張穩定）
function rotationForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 21) - 10); // -10° ~ +10°
}

export default function PolaroidCollage({ config, hostMode, state, myUserName, onPulse }: PolaroidCollageProps) {
  const effectiveState = state ?? buildInitialState();
  const polaroids = effectiveState.polaroids;
  const emojis = config.emojis ?? DEFAULT_EMOJIS;

  const [emoji, setEmoji] = useState(emojis[0]);
  const [message, setMessage] = useState("");
  const [color, setColor] = useState(POLAROID_COLORS[0]);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!message.trim()) return;
    onPulse?.("polaroid", {
      emoji,
      message: message.trim().slice(0, 100),
      color,
    });
    setSubmitted(true);
  }, [emoji, message, color, onPulse]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    // 倒序顯示（新的在上）
    const sorted = [...polaroids].slice(-(config.maxOnScreen ?? 50)).reverse();
    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold mb-2">
            {config.title ?? "📸 紀念牆"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-400">{config.subtitle}</p>
          )}
          <p className="text-sm text-zinc-500 mt-2">
            <span className="font-bold text-primary text-2xl">{polaroids.length}</span> 則祝福
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 text-xl">
            等待第一則祝福...
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center max-w-7xl mx-auto">
            {sorted.map((p, i) => {
              const rot = rotationForId(p.id);
              const isNewest = i === 0;
              return (
                <div
                  key={p.id}
                  className={`relative ${isNewest ? "animate-in fade-in zoom-in duration-500" : ""}`}
                  style={{
                    transform: `rotate(${rot}deg)`,
                    transition: "transform 200ms",
                  }}
                >
                  <div
                    className="w-44 md:w-52 p-3 pb-12 shadow-xl"
                    style={{ backgroundColor: p.color }}
                  >
                    <div className="aspect-square flex items-center justify-center text-7xl bg-white/30 rounded">
                      {p.emoji}
                    </div>
                    <div className="mt-3 text-center text-zinc-800">
                      <p className="text-sm font-medium leading-snug line-clamp-3">{p.message}</p>
                      <p className="text-xs mt-1.5 opacity-60">— {p.author}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── 玩家版型 ───
  if (submitted) {
    return (
      <div className="w-full p-4 max-w-md mx-auto space-y-4">
        <div className="text-center space-y-3 py-8">
          <div className="text-7xl">✅</div>
          <h2 className="text-2xl font-bold">已送出祝福</h2>
          <p className="text-sm text-muted-foreground">
            看大螢幕，你的拍立得正在飄上紀念牆 🎬
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessage("");
          }}
          className="w-full py-3 rounded-lg border font-medium hover:bg-muted text-sm"
          data-testid="btn-send-another"
        >
          再送一張
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">{config.title ?? "📸 留下祝福"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 預覽卡 */}
      <div
        className="w-full p-3 pb-10 shadow-md mx-auto max-w-[200px]"
        style={{ backgroundColor: color, transform: "rotate(-2deg)" }}
      >
        <div className="aspect-square flex items-center justify-center text-6xl bg-white/30 rounded">
          {emoji}
        </div>
        <div className="mt-3 text-center text-zinc-800">
          <p className="text-sm font-medium min-h-[20px]">
            {message || "（空白）"}
          </p>
          <p className="text-xs mt-1 opacity-60">— {myUserName ?? "我"}</p>
        </div>
      </div>

      {/* Emoji 選擇 */}
      <div>
        <label className="text-sm font-medium">選 Emoji</label>
        <div className="grid grid-cols-6 gap-1.5 mt-1">
          {emojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`aspect-square rounded-lg text-2xl transition-all ${
                emoji === e
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "bg-card border hover:border-primary/40"
              }`}
              data-testid={`btn-polaroid-emoji-${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* 訊息 */}
      <div>
        <label className="text-sm font-medium">祝福語</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 100))}
          placeholder="留下你的祝福（最多 100 字）"
          rows={3}
          className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm"
          maxLength={100}
          data-testid="input-polaroid-message"
        />
        <p className="text-xs text-right text-muted-foreground mt-1">
          {message.length}/100
        </p>
      </div>

      {/* 卡片底色 */}
      <div>
        <label className="text-sm font-medium">底色</label>
        <div className="flex gap-2 mt-1">
          {POLAROID_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`flex-1 aspect-square rounded-lg border-2 transition-all ${
                color === c ? "scale-110 border-foreground shadow" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              data-testid={`btn-polaroid-color-${c.slice(1)}`}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!message.trim()}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 active:scale-95 transition-all"
        data-testid="btn-submit-polaroid"
      >
        📸 送上紀念牆
      </button>
    </div>
  );
}
