// 🧩 JigsawPuzzle — 隊伍拼圖協作元件（W4 D1，L 級簡化版 → M 級）
//
// 玩法：
//   - 每個玩家被分配 1 個拼圖格（依進入順序、穩定分配）
//   - 玩家輸入文字描述（Phase 2 會升級為照片上傳）
//   - 全部格子填完 → 全隊解鎖完整拼圖
//
// 設計依據：docs/changes/2026-05-02-multiplayer-component-platform.md（親子市場王牌）
// pageType: jigsaw_puzzle（multi 軸線）
//
// 適用：親子家庭、企業破冰、團隊建立

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface JigsawSlot {
  id: string;       // "r{row}c{col}"
  row: number;
  col: number;
  prompt: string;   // 「拍張紅色物體」「拍門口的對聯」等
  filledBy?: string; // userId / userName
  text?: string;     // 玩家填的文字（簡化版）
  color?: string;    // 玩家選的顏色（簡化版）
}

export interface JigsawPuzzleConfig {
  /** 標題 */
  title?: string;
  /** 副標 */
  subtitle?: string;
  /** 拼圖每格的提示（依 row * col 順序） */
  prompts?: string[];
  /** 網格行數（預設 2）*/
  rows?: number;
  /** 網格列數（預設 2）*/
  cols?: number;
}

interface JigsawState {
  slots: JigsawSlot[];
  isComplete: boolean;
}

export interface JigsawPuzzleProps {
  config: JigsawPuzzleConfig;
  state: JigsawState | null;
  myUserId: string;
  myUserName: string;
  onFillSlot: (slotId: string, text: string, color: string) => void;
}

const COLORS = [
  { value: "#ef4444", label: "紅" },
  { value: "#f97316", label: "橘" },
  { value: "#eab308", label: "黃" },
  { value: "#10b981", label: "綠" },
  { value: "#3b82f6", label: "藍" },
  { value: "#8b5cf6", label: "紫" },
];

/**
 * 穩定分配玩家到某 slot（hash-based）
 * 規則：對 userId 做簡單 hash → 取 slot index
 * 確保同一 user 永遠對到同一格、不論玩家數
 */
function pickSlotForUser(slots: JigsawSlot[], userId: string): JigsawSlot | null {
  const empty = slots.filter((s) => !s.filledBy || s.filledBy === userId);
  if (empty.length === 0) return null;
  // 簡單 hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return empty[Math.abs(hash) % empty.length];
}

export default function JigsawPuzzle({
  config,
  state,
  myUserId,
  myUserName,
  onFillSlot,
}: JigsawPuzzleProps) {
  const rows = config.rows ?? 2;
  const cols = config.cols ?? 2;
  const totalSlots = rows * cols;

  // 預設提示（如果 config 沒給滿）
  const prompts = useMemo(() => {
    const base = config.prompts ?? [];
    return Array.from({ length: totalSlots }, (_, i) => base[i] ?? `第 ${i + 1} 格`);
  }, [config.prompts, totalSlots]);

  const slots: JigsawSlot[] = state?.slots ?? prompts.map((prompt, i) => ({
    id: `r${Math.floor(i / cols)}c${i % cols}`,
    row: Math.floor(i / cols),
    col: i % cols,
    prompt,
  }));

  const mySlot = useMemo(() => pickSlotForUser(slots, myUserId), [slots, myUserId]);
  const myFilledSlot = slots.find((s) => s.filledBy === myUserId);

  // 進度
  const filledCount = slots.filter((s) => s.filledBy).length;
  const isComplete = filledCount === totalSlots;

  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0].value);

  const handleFill = () => {
    if (!mySlot || myFilledSlot) return;
    if (!text.trim()) return;
    onFillSlot(mySlot.id, text.slice(0, 40), color);
    setText("");
  };

  // 全部完成
  if (isComplete) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
        <div className="text-center space-y-2 py-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">拼圖完成！</h2>
          <p className="text-sm text-muted-foreground">全隊一起完成了 {totalSlots} 格</p>
        </div>
        <div
          className="grid gap-2 mx-auto rounded-xl overflow-hidden border-4 border-primary"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            aspectRatio: `${cols} / ${rows}`,
          }}
        >
          {slots.map((s) => (
            <div
              key={s.id}
              className="flex flex-col items-center justify-center p-3 text-center text-white text-sm"
              style={{ backgroundColor: s.color ?? "#888" }}
            >
              <div className="font-bold text-base">{s.text}</div>
              <div className="text-xs opacity-80 mt-1">— {s.filledBy}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-5">
      {/* 標題 + 進度 */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-display font-bold">{config.title ?? "🧩 拼圖協作"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
        <div className="text-xs text-muted-foreground">
          進度：<span className="font-bold text-primary">{filledCount}</span> / {totalSlots}
        </div>
      </div>

      {/* 拼圖 grid 預覽 */}
      <div
        className="grid gap-2 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          aspectRatio: `${cols} / ${rows}`,
        }}
      >
        {slots.map((s) => (
          <div
            key={s.id}
            className={`flex flex-col items-center justify-center p-2 rounded border-2 text-center text-xs transition-all ${
              s.filledBy
                ? "border-emerald-500"
                : mySlot?.id === s.id
                  ? "border-primary border-dashed bg-primary/5"
                  : "border-zinc-300 bg-zinc-50 dark:bg-zinc-900"
            }`}
            style={s.filledBy ? { backgroundColor: s.color ?? "#888", color: "white" } : undefined}
          >
            {s.filledBy ? (
              <>
                <div className="font-bold">{s.text}</div>
                <div className="text-[10px] opacity-80 mt-0.5">— {s.filledBy}</div>
              </>
            ) : (
              <>
                <div className="text-zinc-400">{s.prompt}</div>
                {mySlot?.id === s.id && (
                  <div className="text-primary font-bold text-[10px] mt-1">這是你的格！</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* 我的填寫區 */}
      {!myFilledSlot && mySlot && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">📝 我的格子：「{mySlot.prompt}」</h3>
          <div>
            <label className="text-sm font-medium">關鍵字（最多 40 字）</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 40))}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-background"
              placeholder="例：紅色的門"
              data-testid="input-jigsaw-text"
              maxLength={40}
            />
          </div>
          <div>
            <label className="text-sm font-medium">顏色</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`flex-1 aspect-square rounded-lg border-2 transition-all ${
                    color === c.value ? "scale-110 border-foreground shadow" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  data-testid={`btn-color-${c.value.slice(1)}`}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFill}
            disabled={!text.trim()}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="btn-fill-slot"
          >
            完成這格 🎯
          </button>
        </div>
      )}

      {myFilledSlot && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            ✅ 你已完成「{myFilledSlot.text}」，等待其他隊員完成
          </p>
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        💡 拍照升級版（上傳真實照片拼圖）將於 Phase 2 推出
      </p>
    </div>
  );
}
