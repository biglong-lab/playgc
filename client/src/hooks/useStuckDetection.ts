// 🚧 useStuckDetection — 玩家長時間無互動偵測（Phase 2 / 2026-05-12）
//
// 設計：
//   - 監聽 pointer / keyboard / scroll / visibility 事件、reset timer
//   - 觸發 onStuck() 預設 60 秒（可調）
//   - 提供 reportInteraction() 給元件手動 reset（如 timer 倒數中）
//   - 自動 report 到 telemetry（reportClientEvent stuck_detected）
//
// 用法：
//   const stuck = useStuckDetection({
//     onStuck: () => setShowStuckDialog(true),
//     thresholdMs: 60_000,
//     componentType: "lock_coop",
//     sessionId, userId, pageId,
//   });
//
//   // 元件內部主動 reset（如 timer tick 不算互動）
//   stuck.reset();

import { useEffect, useRef, useCallback } from "react";
import { reportClientEvent } from "@/lib/event-report";

export interface UseStuckDetectionOptions {
  /** 觸發 stuck 的 callback（顯示 dialog 之類）*/
  onStuck: () => void;
  /** 多久沒互動觸發（毫秒、預設 60s）*/
  thresholdMs?: number;
  /** 啟用（false = 整個 hook no-op、預設 true）*/
  enabled?: boolean;
  /** 元件類型（給 telemetry log 用）*/
  componentType?: string;
  /** session id（log 用）*/
  sessionId?: string | null;
  /** user id（log 用）*/
  userId?: string | null;
  /** page id（log 用）*/
  pageId?: string | null;
}

export interface StuckDetectionApi {
  /** 手動重置 timer（如元件偵測到合理活動如 timer tick、可調 reset）*/
  reset: () => void;
}

const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

export function useStuckDetection(opts: UseStuckDetectionOptions): StuckDetectionApi {
  const {
    onStuck,
    thresholdMs = 60_000,
    enabled = true,
    componentType,
    sessionId,
    userId,
    pageId,
  } = opts;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStuckRef = useRef(onStuck);
  const triggeredRef = useRef(false);

  // 把最新 onStuck 存 ref、避免 effect 依賴 callback 重跑
  useEffect(() => {
    onStuckRef.current = onStuck;
  }, [onStuck]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      // 自動 report 到 observability
      try {
        reportClientEvent({
          event: "stuck_detected",
          message: `${componentType ?? "unknown"} 玩家 ${Math.round(thresholdMs / 1000)}s 無互動`,
          context: {
            componentType,
            sessionId,
            userId,
            pageId,
            thresholdMs,
            url: window.location.href.slice(0, 200),
          },
        });
      } catch {
        /* ignore */
      }
      try {
        onStuckRef.current();
      } catch (err) {
        console.error("[useStuckDetection] onStuck threw:", err);
      }
    }, thresholdMs);
  }, [enabled, thresholdMs, componentType, sessionId, userId, pageId]);

  // 監聽互動事件 + visibility（page hide 不算互動、回來算）
  useEffect(() => {
    if (!enabled) return;
    resetTimer();

    const handler = () => resetTimer();
    INTERACTION_EVENTS.forEach((e) =>
      document.addEventListener(e, handler, { passive: true }),
    );
    const onVis = () => {
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      INTERACTION_EVENTS.forEach((e) => document.removeEventListener(e, handler));
      document.removeEventListener("visibilitychange", onVis);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, resetTimer]);

  return { reset: resetTimer };
}
