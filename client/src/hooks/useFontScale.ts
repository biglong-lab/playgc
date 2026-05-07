// 🔠 useFontScale — 文字大小縮放 hook
// 2026-05-07：玩家無障礙支援
//
// 用法：
//   const { scale, setScale } = useFontScale();
//   // 在 Layout 用 setScale("normal" | "large" | "xl") 切換
//
// 實作：
//   - localStorage 持久化（key: chitoFontScale）
//   - 寫入 :root style 的 --font-scale CSS variable
//   - 全站 text-* 透過 calc(var(--font-scale) * size) 自動跟著放大
//   - 玩家手機 + admin 後台都能用

import { useCallback, useEffect, useState } from "react";

export type FontScale = "normal" | "large" | "xl";

const STORAGE_KEY = "chitoFontScale";
const SCALE_VALUES: Record<FontScale, number> = {
  normal: 1,
  large: 1.15,
  xl: 1.3,
};

function readStoredScale(): FontScale {
  if (typeof window === "undefined") return "normal";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "large" || v === "xl") return v;
  } catch { /* noop */ }
  return "normal";
}

function applyScale(scale: FontScale): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-scale", String(SCALE_VALUES[scale]));
  document.documentElement.dataset.fontScale = scale;
}

export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>("normal");

  // 初始化：從 localStorage 讀
  useEffect(() => {
    const stored = readStoredScale();
    setScaleState(stored);
    applyScale(stored);
  }, []);

  const setScale = useCallback((next: FontScale) => {
    setScaleState(next);
    applyScale(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, []);

  return { scale, setScale, scaleValue: SCALE_VALUES[scale] };
}
