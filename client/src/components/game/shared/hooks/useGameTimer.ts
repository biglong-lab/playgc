// ⏱️ 遊戲計時 hook
//
// 用途：給遊戲元件統一的倒數計時邏輯。個人/多人元件都可用。
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §7.1（shared/hooks 規劃）
//
// 規範：
//   - 純前端邏輯，無 side effect 外的副作用
//   - 不依賴 server time（本地時鐘為準），multi 元件需要 server 權威時間時應另建 useServerTimer
//   - 自動清理計時器（unmount 即停止）
//   - setState updater 保持純函式，callbacks 用獨立 effect 觸發（符合 React Strict Mode）
//
// 範例：
//   const { remaining, isExpired, formatted, pause, resume } = useGameTimer({
//     durationSec: 60,
//     onExpired: () => onComplete(),
//   });

import { useEffect, useRef, useState, useCallback } from "react";

export interface UseGameTimerOptions {
  /** 倒數秒數（必填） */
  durationSec: number;
  /** 是否自動開始（預設 true） */
  autoStart?: boolean;
  /** 倒數歸零時觸發 */
  onExpired?: () => void;
  /** 每秒 tick 時觸發（remaining 為剩餘秒數） */
  onTick?: (remaining: number) => void;
}

export interface UseGameTimerResult {
  /** 剩餘秒數（0 ~ durationSec） */
  remaining: number;
  /** 是否已到時間 */
  isExpired: boolean;
  /** 是否正在跑（pause 後為 false） */
  isRunning: boolean;
  /** 格式化字串 "MM:SS"（給 UI 顯示用） */
  formatted: string;
  /** 暫停（保留剩餘秒數） */
  pause: () => void;
  /** 繼續（從暫停的剩餘秒數恢復） */
  resume: () => void;
  /** 重置為初始 durationSec */
  reset: () => void;
}

/**
 * 格式化秒數為 "MM:SS"（不滿 60 秒也補零，讓 tabular-nums 對齊）
 */
function formatSeconds(sec: number): string {
  const safeSec = Math.max(0, Math.floor(sec));
  const mm = Math.floor(safeSec / 60);
  const ss = safeSec % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

/**
 * 遊戲倒數計時 hook
 *
 * 每秒減 1，到 0 觸發 onExpired，並回傳 isExpired=true、isRunning=false。
 * 支援 pause / resume / reset。
 *
 * unmount 時自動清掉 setInterval（無洩漏）。
 */
export function useGameTimer({
  durationSec,
  autoStart = true,
  onExpired,
  onTick,
}: UseGameTimerOptions): UseGameTimerResult {
  const [remaining, setRemaining] = useState<number>(durationSec);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  // epoch 是用來強制 tick effect 重跑（reset 時會 +1）
  const [epoch, setEpoch] = useState<number>(0);

  // 用 ref 即時追蹤當前 remaining（在 setInterval callback 內讀取，
  //   避免依賴 React re-render 才能拿到新值的問題）
  const remainingRef = useRef<number>(durationSec);

  // 用 ref 同步最新 callback，避免 effect 重跑
  const onExpiredRef = useRef(onExpired);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onExpiredRef.current = onExpired;
    onTickRef.current = onTick;
  }, [onExpired, onTick]);

  // === 倒數 tick effect ===
  // 在 setInterval callback 內直接呼叫 callback（不走 React re-render 路徑），
  // 確保每次 tick 都會 fire onTick / onExpired，即使在 fake timer 快進中
  useEffect(() => {
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      // Guard：避免已歸零後再 fire（在 fake timer 快進期間，
      //   React 來不及 re-render 觸發 cleanup，setInterval 仍會持續執行）
      if (remainingRef.current === 0) return;

      const next = Math.max(0, remainingRef.current - 1);
      remainingRef.current = next;
      setRemaining(next);
      onTickRef.current?.(next);

      if (next === 0) {
        setIsRunning(false);
        onExpiredRef.current?.();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning, epoch]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (remainingRef.current > 0) setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    remainingRef.current = durationSec;
    setRemaining(durationSec);
    setIsRunning(autoStart);
    // 強制 tick effect 重跑（即使 isRunning 不變）
    setEpoch((e) => e + 1);
  }, [durationSec, autoStart]);

  return {
    remaining,
    isExpired: remaining === 0,
    isRunning,
    formatted: formatSeconds(remaining),
    pause,
    resume,
    reset,
  };
}
