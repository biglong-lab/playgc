// 👤 useMyUserName — 統一玩家名字 hook（W14 D3）
//
// 來源優先序：
// 1. URL query `line_display_name`（LIFF 中繼頁帶過來、即時）
// 2. localStorage `chitoUserName`（既有偏好、跨頁持久）
// 3. 空字串（玩家需手動輸入）
//
// 使用：在 host Page 元件中直接呼叫
//   const myUserName = useMyUserName();
//
// 寫入：登入後或玩家輸入後呼叫 setMyUserName(name)

import { useEffect, useState } from "react";

const STORAGE_KEY = "chitoUserName";
const MAX_LENGTH = 30;

/**
 * 讀玩家名字（LINE profile / localStorage / 空）
 */
export function useMyUserName(): string {
  const [name, setName] = useState<string>(() => readInitialName());

  useEffect(() => {
    // 監聽 storage 事件（其他 tab 變更時同步）
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setName(e.newValue || "");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return name;
}

function readInitialName(): string {
  if (typeof window === "undefined") return "";

  // 1. URL query
  const params = new URLSearchParams(window.location.search);
  const lineName = params.get("line_display_name");
  if (lineName) {
    const cleaned = lineName.slice(0, MAX_LENGTH);
    localStorage.setItem(STORAGE_KEY, cleaned);
    return cleaned;
  }

  // 2. localStorage
  return localStorage.getItem(STORAGE_KEY) || "";
}

/**
 * 設玩家名字（手動輸入時用）
 */
export function setMyUserName(name: string): void {
  if (typeof window === "undefined") return;
  const cleaned = name.trim().slice(0, MAX_LENGTH);
  if (cleaned) {
    localStorage.setItem(STORAGE_KEY, cleaned);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
