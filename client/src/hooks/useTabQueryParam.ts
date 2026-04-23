// 📎 useTabQueryParam — Tab 狀態雙向同步到 URL query
//
// 用途：多 Tab 頁面（Settings、Dashboard 等）切 Tab 時把 state 寫 URL，
//      F5 刷新或分享連結可直接進入對應 Tab。
//
// 用法：
//   const VALID = ["intro", "features", "brand"] as const;
//   const [tab, setTab] = useTabQueryParam(VALID, "intro");
//
//   <Tabs value={tab} onValueChange={setTab}>...</Tabs>
//
// 特性：
//   - 只接受白名單 tabs（防 URL 亂塞）
//   - 用 replaceState（不污染 history）
//   - 監聽 popstate（上一頁/下一頁同步）
//   - 可自訂 query param 名稱（預設 "tab"）
import { useCallback, useEffect, useState } from "react";

export function useTabQueryParam<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramName = "tab",
): [T, (tab: T) => void] {
  const readFromUrl = useCallback((): T => {
    if (typeof window === "undefined") return defaultTab;
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get(paramName);
      return (validTabs as readonly string[]).includes(t ?? "")
        ? (t as T)
        : defaultTab;
    } catch {
      return defaultTab;
    }
  }, [validTabs, defaultTab, paramName]);

  const [activeTab, setActiveTab] = useState<T>(readFromUrl);

  // popstate（上一頁/下一頁）觸發重讀
  useEffect(() => {
    const handler = () => setActiveTab(readFromUrl());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [readFromUrl]);

  const setTab = useCallback(
    (tab: T) => {
      setActiveTab(tab);
      try {
        const params = new URLSearchParams(window.location.search);
        params.set(paramName, tab);
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}?${params.toString()}`,
        );
      } catch {
        /* sandbox 或不支援 history API */
      }
    },
    [paramName],
  );

  return [activeTab, setTab];
}
