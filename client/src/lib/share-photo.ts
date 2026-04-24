// 📤 照片分享/下載統一工具
//
// 為什麼統一？
// - 原本每個 photo_* 元件都有自己的 handleShare/handleDownload
// - 大部分 handleShare 都 fetch(url).blob() → 遇到 CORS 失敗率高（iOS Safari、Cloudinary 偶發）
// - 下載最可靠方式是 <a href download> 讓瀏覽器處理
//
// 這個工具：
// - shareUrl：優先用 Web Share API 直接分享 URL（不 fetch blob）
// - triggerDownload：建立臨時 <a download> click
// 各元件只要呼叫這兩個即可

export interface ShareOptions {
  url: string;
  title?: string;
  text?: string;
  onCopied?: () => void;
  onOpenedTab?: () => void;
}

/**
 * 分享 URL（不 fetch blob，避免 CORS 問題）
 * 行為優先序：
 *   1. navigator.share({url}) — iOS/Android 原生分享單
 *   2. navigator.clipboard.writeText(url) — 複製到剪貼簿
 *   3. window.open(url) — 開新 tab 讓使用者長按存圖
 */
export async function shareUrl(opts: ShareOptions): Promise<"shared" | "copied" | "opened"> {
  const { url, title, text, onCopied, onOpenedTab } = opts;

  // 1. Web Share API
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: title || "CHITO 紀念",
        text: text || "看看我的遊戲紀念照！",
        url,
      });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") {
        return "shared"; // 使用者取消也算分享
      }
      // 其他錯誤 fallthrough
    }
  }

  // 2. 剪貼簿
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      onCopied?.();
      return "copied";
    }
  } catch {
    // fallthrough
  }

  // 3. 開新 tab
  window.open(url, "_blank", "noopener,noreferrer");
  onOpenedTab?.();
  return "opened";
}

/**
 * 觸發下載（用 <a download>，跨瀏覽器最穩）
 * 若 URL 是跨域且 server 沒回 Content-Disposition，
 * iOS Safari 會開新 tab 而不是下載 — 屬正常 fallback。
 */
export function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 產生下載檔名（帶時戳，副檔名由 URL 判斷）*/
export function makeDownloadFilename(url: string, prefix = "chito"): string {
  const ext = url.match(/\.(gif|webp|mp4|jpg|jpeg|png)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
  return `${prefix}-${Date.now()}.${ext}`;
}
