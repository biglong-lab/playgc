import { useEffect, useRef } from "react";

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeOptions {
  threshold?: number;
  maxVerticalRatio?: number;
  enabled?: boolean;
}

/**
 * useSwipe — 偵測四向滑動手勢
 *
 * 預設 threshold 50px、垂直/水平偏差比 0.6（避免誤判捲動）。
 * 對手機 Web + PWA 都生效；桌機沒 touchstart 自動 noop。
 */
export function useSwipe(
  target: React.RefObject<HTMLElement> | null,
  handlers: SwipeHandlers,
  options: SwipeOptions = {},
): void {
  const { threshold = 50, maxVerticalRatio = 0.6, enabled = true } = options;
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const el = target?.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      startTime.current = Date.now();
    };

    const handleEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const dt = Date.now() - startTime.current;

      if (dt > 800) return;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dy) / Math.abs(dx) > maxVerticalRatio) return;
        if (dx > 0) handlers.onSwipeRight?.();
        else handlers.onSwipeLeft?.();
      } else {
        if (Math.abs(dx) / Math.abs(dy) > maxVerticalRatio) return;
        if (dy > 0) handlers.onSwipeDown?.();
        else handlers.onSwipeUp?.();
      }
    };

    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchend", handleEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchend", handleEnd);
    };
  }, [target, handlers, threshold, maxVerticalRatio, enabled]);
}
