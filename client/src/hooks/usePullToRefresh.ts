// 📲 usePullToRefresh — 下拉重整 hook
// 2026-05-09：PWA 體感優化的核心元件
//
// 設計重點：
//   - 監聽 document 全域 touch 事件、不需要 wrapper
//   - 必須 window.scrollY === 0 才會啟動（避免滾動中誤觸）
//   - clientX < edgeProtection 不啟動（保留 iOS 邊緣 swipe-back）
//   - 達 visualThreshold 觸覺回饋（Android 才有效，iOS 安靜 fallback）
//   - 阻尼曲線：實際拉動 = 觸控位移 × 0.5（拉越遠越難拉）
//   - refresh 動畫至少顯示 minRefreshMs（避免閃一下沒感覺）
//   - refresh 失敗靜默（不阻擋 UI、由呼叫端處理 toast）
//
// 不要套用在：
//   - 遊戲進行中元件（BattleLayout、TriviaShowdown、PolaroidCollage 等）
//   - Modal / Dialog 內部
//   - 任何有自訂滑動互動的頁面

import { useCallback, useEffect, useRef, useState } from "react";
import { useHaptic } from "./useHaptic";

interface PullToRefreshOptions {
  /** 重整 callback（async / sync 都可）*/
  onRefresh: () => Promise<void> | void;
  /** 觸發距離（px）— 鬆手達到此距離才會 refresh，預設 80 */
  threshold?: number;
  /** 視覺 threshold — 拉到此距離開始顯示「放開重整」+ 觸覺，預設 60 */
  visualThreshold?: number;
  /** 最大拉動距離（避免拉到天上去），預設 120 */
  maxDistance?: number;
  /** 是否啟用（false = 完全不監聽）。可動態切換，遊戲進行時請傳 false */
  enabled?: boolean;
  /** Refresh 動畫至少顯示時長（ms），預設 600 */
  minRefreshMs?: number;
  /** 邊緣保留區（px）— clientX < 此值不啟動 PTR，保留 iOS swipe-back，預設 24 */
  edgeProtection?: number;
}

export interface PullToRefreshResult {
  /** 正在拉（finger 在螢幕上）*/
  isPulling: boolean;
  /** 當前拉動距離（0 ~ maxDistance），給 UI 顯示用 */
  pullDistance: number;
  /** 正在執行 refresh callback（含 minRefreshMs 等待）*/
  isRefreshing: boolean;
  /** 已達觸發 threshold（給 indicator 切換「下拉」/「放開」文案用）*/
  isAtThreshold: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  visualThreshold = 60,
  maxDistance = 120,
  enabled = true,
  minRefreshMs = 600,
  edgeProtection = 24,
}: PullToRefreshOptions): PullToRefreshResult {
  const haptic = useHaptic();

  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 用 ref 持有最新 state，讓 handler 不必重新綁定
  const stateRef = useRef({ pullDistance: 0, isRefreshing: false, isPulling: false });
  stateRef.current = { pullDistance, isRefreshing, isPulling };

  // 用 ref 持有最新 onRefresh（callback 可能每次 render 變）
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const startYRef = useRef<number | null>(null);
  const reachedThresholdRef = useRef(false);

  const isAtThreshold = pullDistance >= visualThreshold;

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (stateRef.current.isRefreshing) return;
      // 不在頁面頂端 → 不啟動
      if (window.scrollY > 0) return;
      const t = e.touches[0];
      if (!t) return;
      // 邊緣保留給 iOS swipe-back（左右兩側）
      if (t.clientX < edgeProtection) return;
      if (t.clientX > window.innerWidth - edgeProtection) return;
      startYRef.current = t.clientY;
      reachedThresholdRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      // 滾動偏離頂端 → 取消（避免拉到一半 scrollY 跳）
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPullDistance(0);
        setIsPulling(false);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startYRef.current;
      // 上滑 → 釋放
      if (dy <= 0) {
        if (stateRef.current.isPulling) {
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }
      // 阻尼曲線
      const damped = Math.min(maxDistance, dy * 0.5);
      setPullDistance(damped);
      if (!stateRef.current.isPulling) setIsPulling(true);

      // 達 threshold 觸覺回饋（一次）
      if (damped >= visualThreshold && !reachedThresholdRef.current) {
        reachedThresholdRef.current = true;
        haptic.tap();
      }
      if (damped < visualThreshold && reachedThresholdRef.current) {
        reachedThresholdRef.current = false;
      }

      // 拉動明顯時阻止 iOS 橡皮筋（避免畫面整個被拉走）
      if (damped > 10 && e.cancelable) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (startYRef.current === null) return;
      const distance = stateRef.current.pullDistance;
      startYRef.current = null;

      if (distance >= threshold && !stateRef.current.isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(visualThreshold); // 卡在 threshold 顯示動畫
        const startTs = Date.now();
        try {
          await Promise.resolve(onRefreshRef.current());
        } catch {
          // refresh 失敗靜默；由呼叫端透過 toast 處理
        }
        const elapsed = Date.now() - startTs;
        if (elapsed < minRefreshMs) {
          await new Promise((r) => setTimeout(r, minRefreshMs - elapsed));
        }
        setIsRefreshing(false);
        setPullDistance(0);
        setIsPulling(false);
      } else {
        // 沒到 threshold → 回彈
        setPullDistance(0);
        setIsPulling(false);
      }
      reachedThresholdRef.current = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, edgeProtection, threshold, visualThreshold, maxDistance, minRefreshMs, haptic]);

  return { isPulling, pullDistance, isRefreshing, isAtThreshold };
}
