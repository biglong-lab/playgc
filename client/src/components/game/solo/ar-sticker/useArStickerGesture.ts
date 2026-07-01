// 🖐️ useArStickerGesture — AR 貼圖單指拖曳 + 雙指縮放手勢（ProPlan CHITO AR #1）
//
// 設計：回傳一組「群組 transform」{dx, dy, scale}，套用在固定位置貼圖圖層。
//   - dx/dy：位移，以容器短邊為單位的比例（解析度無關，方便同步到 canvas 合成）
//   - scale：縮放倍率（1 = 原大小）
//   單指拖曳更新 dx/dy；雙指縮放更新 scale。
//   純加法：不動手勢時 transform = identity、貼圖維持 config 原位。
import { useCallback, useRef, useState } from "react";
import type React from "react";

export interface ArStickerTransform {
  /** 位移 x（容器短邊比例，向右為正）*/
  dx: number;
  /** 位移 y（容器短邊比例，向下為正）*/
  dy: number;
  /** 縮放倍率 */
  scale: number;
}

export const AR_STICKER_IDENTITY: ArStickerTransform = { dx: 0, dy: 0, scale: 1 };
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

interface Pt {
  x: number;
  y: number;
}

function centroid(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface ArStickerGesture {
  transform: ArStickerTransform;
  reset: () => void;
  /** 是否被使用者動過（決定 UI 是否顯示「重置」）*/
  isDirty: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useArStickerGesture(
  containerRef: React.RefObject<HTMLElement | null>,
): ArStickerGesture {
  const [transform, setTransform] = useState<ArStickerTransform>(AR_STICKER_IDENTITY);
  const pointers = useRef<Map<number, Pt>>(new Map());
  // 手勢起點快照（每當按下的手指數改變就重抓、避免跳動）
  const start = useRef<{ transform: ArStickerTransform; center: Pt; dist: number } | null>(null);

  const shortSide = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return Math.min(r.width, r.height) || 1;
  }, [containerRef]);

  // 用「當前所有 pointer + 當前 transform」重抓手勢起點
  const rebase = useCallback((current: ArStickerTransform) => {
    const pts = Array.from(pointers.current.values());
    start.current = {
      transform: current,
      center: centroid(pts),
      dist: pts.length >= 2 ? distance(pts[0], pts[1]) : 0,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setTransform((t) => {
        rebase(t);
        return t;
      });
    },
    [rebase],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = start.current;
      if (!s) return;
      const pts = Array.from(pointers.current.values());
      const c = centroid(pts);
      const unit = shortSide();
      const dx = s.transform.dx + (c.x - s.center.x) / unit;
      const dy = s.transform.dy + (c.y - s.center.y) / unit;
      let scale = s.transform.scale;
      if (pts.length >= 2 && s.dist > 0) {
        scale = clamp(s.transform.scale * (distance(pts[0], pts[1]) / s.dist), MIN_SCALE, MAX_SCALE);
      }
      setTransform({ dx, dy, scale });
    },
    [shortSide],
  );

  const endPointer = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.delete(e.pointerId)) return;
      // 手指數改變 → 用剩餘手指 + 當前 transform 重抓起點，避免放開一指時跳動
      setTransform((t) => {
        rebase(t);
        return t;
      });
    },
    [rebase],
  );

  const reset = useCallback(() => {
    setTransform(AR_STICKER_IDENTITY);
    start.current = null;
  }, []);

  const isDirty =
    transform.dx !== 0 || transform.dy !== 0 || transform.scale !== 1;

  return {
    transform,
    reset,
    isDirty,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
    },
  };
}
