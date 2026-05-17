// 🔍 Auth 環境偵測 — 用於登入 UI 決定顯示哪些按鈕（2026-05-17）
//
// 業主需求（5/17）：
//   - LINE 內建瀏覽器 → Google OAuth 會卡 → 隱藏 Google 按鈕
//   - LIFF 環境 → 已自動有 LINE 身份 → 不顯示登入頁
//   - 一般瀏覽器 → 全部按鈕都顯示（LINE / Google / 帳密）

/** 是否在 LINE app 內建瀏覽器（user agent 含 "Line/"） */
export function isInLineApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Line\//i.test(navigator.userAgent);
}

/** 是否在 LIFF 環境（window.liff 已 init 且 isInClient） */
export function isInLiff(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { liff?: { isInClient?: () => boolean } };
  try {
    return !!w.liff?.isInClient?.();
  } catch {
    return false;
  }
}

/** Auth 提供者偏好決策 */
export interface AuthProviderVisibility {
  showLine: boolean;
  showGoogle: boolean;
  showEmail: boolean;
}

export function getAuthProviderVisibility(): AuthProviderVisibility {
  const inLine = isInLineApp();
  return {
    showLine: true,
    // LINE 內建瀏覽器 → 隱藏 Google（OAuth popup 會卡）
    showGoogle: !inLine,
    showEmail: true,
  };
}
