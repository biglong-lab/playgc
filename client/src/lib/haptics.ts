/**
 * Haptics — 觸覺回饋統一 API
 *
 * 設計原則：
 * - PWA + Android Chrome：navigator.vibrate 可用、觸發實體震動
 * - iOS Safari：vibrate API 不支援、自動 noop（不報錯）
 * - 桌機 / 平板：noop
 * - 全域 throttle 100ms 防連發
 * - localStorage `haptics:disabled = "1"` 可讓玩家關閉
 */

const THROTTLE_MS = 100;
let lastFired = 0;

function canVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.vibrate !== "function") return false;
  return true;
}

function userDisabled(): boolean {
  try {
    return localStorage.getItem("haptics:disabled") === "1";
  } catch {
    return false;
  }
}

function fire(pattern: number | number[]): void {
  if (!canVibrate() || userDisabled()) return;
  const now = Date.now();
  if (now - lastFired < THROTTLE_MS) return;
  lastFired = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

export const haptics = {
  /** 輕微點擊（按鈕、tab 切換）— 8ms */
  light: () => fire(8),
  /** 標準回饋（提交、選擇）— 20ms */
  medium: () => fire(20),
  /** 強烈回饋（重要動作、完成）— 40ms */
  strong: () => fire(40),
  /** 成功（短-停-短）— 自然節奏 */
  success: () => fire([20, 60, 20]),
  /** 失敗（短-停-長）— 提示 */
  error: () => fire([10, 50, 80]),
  /** 警示（連續三短）*/
  warning: () => fire([15, 40, 15, 40, 15]),
  /** 自訂 pattern */
  custom: (pattern: number | number[]) => fire(pattern),
};

export function setHapticsEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem("haptics:disabled");
    } else {
      localStorage.setItem("haptics:disabled", "1");
    }
  } catch {
    // ignore
  }
}

export function isHapticsEnabled(): boolean {
  return canVibrate() && !userDisabled();
}
