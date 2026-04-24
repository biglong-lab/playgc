// 🖥️ 客戶端平台偵測工具
//
// 用於決定 UI 顯示樣式（例如鍵盤快捷鍵圖示 ⌘ vs Ctrl）。
// 注意：絕對不能拿來當作安全依據或功能差異，使用者可偽造 user agent。

/**
 * 偵測當前客戶端是否為 macOS / iOS 家族。
 * 優先讀 `navigator.platform`（雖然已 deprecated 但仍最穩定），
 * 再 fallback 到 `navigator.userAgent`。
 */
export function isMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(
    navigator.platform || navigator.userAgent || "",
  );
}
