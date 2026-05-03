// 📺 BingoBoard — HostScreen 5×5 賓果板元件（W22 D1，5 大市場通用）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md
// pageType: host_bingo_board
//
// 玩法：
//   - 大螢幕：5×5 任務板、玩家完成任務時 cell 變綠 ✓、達成連線（橫/直/斜）高亮
//   - 玩家端：點擊任務按鈕送 pulse、達 requiredCount 該 cell 視為完成
//   - 適用：園遊會攤位集點、商圈集章、員工旅遊任務、婚禮賓客 bingo、生日聚會
//
// state 結構：
//   {
//     completed: Record<taskId, number>;  // 每任務累積完成數
//     claimedLines: string[];             // 已達成的連線 id
//     totalParticipants: number;          // 累計參與人數
//   }
//
// pulse 結構：
//   { type: "task_complete", payload: { taskId: "t-1" } }
//
// 連線 id 命名：
//   - 橫線：row-0..4
//   - 直線：col-0..4
//   - 斜線：diag-tl-br / diag-tr-bl

import { useMemo } from "react";

export interface BingoTask {
  id: string;
  label: string;
  /** 顯示用 emoji 或 icon 名 */
  emoji?: string;
  /** 達 N 次完成才視為通關（預設 1）*/
  requiredCount?: number;
}

export interface BingoBoardConfig {
  /** 預設 5×5、可調 3-7 */
  rows?: number;
  cols?: number;
  /** 25 個任務（5×5）；不足時補空白 */
  tasks: BingoTask[];
  /** 標題 */
  title?: string;
  /** 副標 */
  subtitle?: string;
  /** 自由格（中央）標籤、預設「自由」*/
  freeCellLabel?: string;
}

export interface BingoBoardState {
  completed: Record<string, number>;
  claimedLines: string[];
  totalParticipants: number;
}

export interface BingoBoardProps {
  config: BingoBoardConfig;
  hostMode: boolean;
  state?: BingoBoardState | null;
  onPulse?: (pulseType: string, payload: { taskId: string }) => void;
  onBroadcastState?: (state: BingoBoardState) => void;
}

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;

function buildInitialState(): BingoBoardState {
  return {
    completed: {},
    claimedLines: [],
    totalParticipants: 0,
  };
}

/** 計算所有可能的連線（5 橫 + 5 直 + 2 斜 = 12 條）*/
export function computeLines(rows: number, cols: number): Array<{ id: string; cells: number[] }> {
  const lines: Array<{ id: string; cells: number[] }> = [];

  for (let r = 0; r < rows; r++) {
    lines.push({ id: `row-${r}`, cells: Array.from({ length: cols }, (_, c) => r * cols + c) });
  }
  for (let c = 0; c < cols; c++) {
    lines.push({ id: `col-${c}`, cells: Array.from({ length: rows }, (_, r) => r * cols + c) });
  }
  if (rows === cols) {
    lines.push({ id: "diag-tl-br", cells: Array.from({ length: rows }, (_, i) => i * cols + i) });
    lines.push({ id: "diag-tr-bl", cells: Array.from({ length: rows }, (_, i) => i * cols + (cols - 1 - i)) });
  }
  return lines;
}

/** 判斷某 cell 是否完成（達 requiredCount）*/
function isCellCompleted(task: BingoTask | undefined, completedCount: number): boolean {
  if (!task) return false;
  return completedCount >= (task.requiredCount ?? 1);
}

export default function BingoBoard({ config, hostMode, state, onPulse }: BingoBoardProps) {
  const rows = config.rows ?? DEFAULT_ROWS;
  const cols = config.cols ?? DEFAULT_COLS;
  const totalCells = rows * cols;
  const effectiveState = state ?? buildInitialState();

  const cells = useMemo(() => {
    const arr: BingoTask[] = [];
    for (let i = 0; i < totalCells; i++) {
      const task = config.tasks[i];
      arr.push(task ?? { id: `empty-${i}`, label: "" });
    }
    return arr;
  }, [config.tasks, totalCells]);

  const lines = useMemo(() => computeLines(rows, cols), [rows, cols]);

  const completedCellIndices = useMemo(() => {
    const set = new Set<number>();
    cells.forEach((task, i) => {
      const count = effectiveState.completed[task.id] ?? 0;
      if (isCellCompleted(task, count)) set.add(i);
    });
    return set;
  }, [cells, effectiveState.completed]);

  const activeLines = useMemo(() => {
    return lines.filter((line) => line.cells.every((idx) => completedCellIndices.has(idx)));
  }, [lines, completedCellIndices]);

  const completionRate = totalCells > 0 ? completedCellIndices.size / totalCells : 0;

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-zinc-950 dark:via-amber-950/40 dark:to-rose-950/40 p-4">
        <div className="w-full max-w-5xl flex flex-col items-center">
          <h1 className="text-3xl md:text-5xl font-bold text-amber-900 dark:text-amber-100 mb-2">
            {config.title ?? "🎯 Bingo 集章板"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-amber-700 dark:text-amber-300 mb-4">{config.subtitle}</p>
          )}
          <div className="flex gap-6 mb-6 text-amber-800 dark:text-amber-200">
            <div className="text-center">
              <div className="text-3xl font-bold">{completedCellIndices.size}/{totalCells}</div>
              <div className="text-sm opacity-70">已完成</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">{activeLines.length}</div>
              <div className="text-sm opacity-70">連線達成</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{Math.round(completionRate * 100)}%</div>
              <div className="text-sm opacity-70">完成率</div>
            </div>
          </div>

          <div
            className="grid gap-2 w-full max-w-3xl"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            data-testid="bingo-grid"
          >
            {cells.map((task, i) => {
              const count = effectiveState.completed[task.id] ?? 0;
              const completed = completedCellIndices.has(i);
              const inLine = activeLines.some((l) => l.cells.includes(i));
              return (
                <div
                  key={`${task.id}-${i}`}
                  data-testid={`bingo-cell-${i}`}
                  className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center p-2 transition-all duration-300 ${
                    completed
                      ? inLine
                        ? "bg-gradient-to-br from-rose-400 to-pink-500 border-rose-500 text-white scale-105 shadow-lg"
                        : "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-900 dark:text-emerald-100"
                      : "bg-white/60 dark:bg-zinc-800/60 border-amber-200 dark:border-zinc-700 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  {task.emoji && <div className="text-2xl md:text-3xl mb-1">{task.emoji}</div>}
                  <div className="text-xs md:text-sm font-medium leading-tight">{task.label}</div>
                  {task.requiredCount && task.requiredCount > 1 && !completed && (
                    <div className="text-[10px] opacity-60 mt-1">{count}/{task.requiredCount}</div>
                  )}
                  {completed && <div className="text-lg md:text-2xl mt-1">✓</div>}
                </div>
              );
            })}
          </div>

          {activeLines.length > 0 && (
            <div className="mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold shadow-lg animate-pulse">
              🎉 達成 {activeLines.length} 條連線！
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 玩家版型（手機端）───
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-zinc-950 dark:to-amber-950/30 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-1 text-center">
          {config.title ?? "🎯 Bingo 集章"}
        </h1>
        {config.subtitle && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4 text-center">{config.subtitle}</p>
        )}
        <div className="text-center text-sm text-amber-800 dark:text-amber-200 mb-4">
          已完成 {completedCellIndices.size}/{totalCells} · {activeLines.length} 條連線
        </div>

        <div className="space-y-2">
          {config.tasks.map((task) => {
            const count = effectiveState.completed[task.id] ?? 0;
            const completed = isCellCompleted(task, count);
            return (
              <button
                key={task.id}
                data-testid={`bingo-task-${task.id}`}
                onClick={() => onPulse?.("task_complete", { taskId: task.id })}
                disabled={completed}
                className={`w-full p-3 rounded-lg border-2 flex items-center justify-between transition-colors ${
                  completed
                    ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400 text-emerald-900 dark:text-emerald-100 opacity-70"
                    : "bg-white dark:bg-zinc-800 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95"
                }`}
              >
                <div className="flex items-center gap-3">
                  {task.emoji && <span className="text-2xl">{task.emoji}</span>}
                  <span className="font-medium text-left">{task.label}</span>
                </div>
                <div className="text-sm">
                  {completed ? "✓ 已完成" : task.requiredCount && task.requiredCount > 1 ? `${count}/${task.requiredCount}` : "點擊完成"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
