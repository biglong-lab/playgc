// 🗄️ useLocalStorageState — 像 useState 但自動同步到 localStorage
//
// 用途：玩家的搜尋條件、filter 選擇、UI 偏好等，刷新頁後保留
//
// 用法：
//   const [search, setSearch] = useLocalStorageState("home_search", "");
//   const [filter, setFilter] = useLocalStorageState<string | null>("home_filter", null);
//
// 注意：
//   - key 變化時，state 不會重讀 localStorage（組件 re-mount 才會）
//   - 無法跨 tab/window 同步（這裡不做，需要時用 storage event）
//   - SSR 安全（window undefined 時 fallback initial）
import { useCallback, useEffect, useState } from "react";

export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* JSON parse 失敗或 localStorage 不可用 */
    }
    return initial;
  });

  // value 變化 → 寫回 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // null / undefined / 空字串 → 移除 key 保持 localStorage 乾淨
      if (value === null || value === undefined || value === "") {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      /* quota 滿或 private 模式 */
    }
  }, [key, value]);

  // 包一層 setter，讓 functional setter 也可用
  const setStored = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) =>
      typeof next === "function" ? (next as (prev: T) => T)(prev) : next,
    );
  }, []);

  return [value, setStored];
}
