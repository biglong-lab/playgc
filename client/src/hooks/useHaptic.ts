// 📳 useHaptic — 震動回饋 hook
// 2026-05-07：相機統一改造的一部分
//
// 用法：
//   const haptic = useHaptic();
//   haptic.success();   // 短震一下（拍照成功 / 答對 / 通關）
//   haptic.error();     // 兩短一停（答錯 / 失敗）
//   haptic.tap();       // 極短（按鈕 click）
//   haptic.notify();    // 中強（重要提示）
//
// 兼容性：
//   - Android Chrome：完整支援 navigator.vibrate(pattern)
//   - iOS Safari：navigator.vibrate 存在但無效（需 PWA + iOS 17+ 才有有限支援）
//   - 不支援時 noop（不報錯、不彈訊息）

import { useCallback, useMemo } from "react";

interface HapticAPI {
  /** 短震 50ms — 拍照成功、答對、通關 */
  success: () => void;
  /** 兩短一停 — 答錯、失敗、警告 */
  error: () => void;
  /** 極短 10ms — 按鈕 tap */
  tap: () => void;
  /** 中強 100ms — 重要提示 */
  notify: () => void;
  /** 自訂 pattern（陣列：vibrate ms / pause ms / vibrate ms ...）*/
  custom: (pattern: number | number[]) => void;
  /** 是否支援 */
  supported: boolean;
}

function vibrateOrNoop(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // noop — 部分瀏覽器拋 SecurityError
  }
}

export function useHaptic(): HapticAPI {
  const supported =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const success = useCallback(() => vibrateOrNoop(50), []);
  const error = useCallback(() => vibrateOrNoop([50, 30, 50]), []);
  const tap = useCallback(() => vibrateOrNoop(10), []);
  const notify = useCallback(() => vibrateOrNoop(100), []);
  const custom = useCallback((pattern: number | number[]) => vibrateOrNoop(pattern), []);

  return useMemo(
    () => ({ success, error, tap, notify, custom, supported }),
    [success, error, tap, notify, custom, supported],
  );
}
