// 📸 統一照片保存工具 — 所有 photo flow 共用
//
// 設計原則：
//   1. 預設目標 = 手機相簿（最順暢的使用者體驗）
//   2. iOS / Android：用 navigator.share + File → 系統 share sheet 內可一鍵「儲存到相簿」
//   3. Desktop：fallback `<a download>` 到下載資料夾
//   4. 所有錯誤都吞掉，回傳 enum result 給 UI 顯示對應 toast

export type SaveTarget = "album" | "share" | "download";

export interface SaveResult {
  success: boolean;
  /** 實際採用的方式（給 UI 顯示對應提示）*/
  method: "share-with-files" | "share-url-only" | "download" | "copy-url" | "none";
  /** 失敗原因（success=false 時）*/
  errorReason?: "abort" | "blocked" | "no-support" | "fetch-failed" | "unknown";
}

export interface SavePhotoOptions {
  /** 圖片 URL（cloudinary / data url 都可）*/
  url: string;
  /** 檔名（不含副檔名）*/
  filename?: string;
  /** 分享標題 */
  title?: string;
  /** 分享文字 */
  text?: string;
  /** 強制使用某種方式（debug 用）*/
  forceMethod?: "share" | "download";
}

/**
 * 偵測手機環境
 *   - iOS Safari / Android Chrome → 適合用 navigator.share（系統 share sheet 可存到相簿）
 *   - Desktop → fallback 下載
 */
export function isMobileWithShare(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod|android/.test(ua) ||
    // iOS 13+ Safari User-Agent 隱藏 ipad → 用 navigator.maxTouchPoints 判斷
    (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1)
  );
}

/**
 * 把 URL 轉成 File（給 Web Share API 用）
 */
async function urlToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status}`);
  }
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

/**
 * 主入口：保存照片（預設優先存到手機相簿）
 *
 * UX 流程：
 *   📱 手機（iOS/Android）：跳出系統 share sheet → 使用者點「儲存到相簿」
 *   💻 桌機：直接觸發瀏覽器下載
 *
 * 優點：
 *   - 不再需要使用者「長按 → 儲存」（最常見的痛點）
 *   - 一個按鈕，不用煩惱「下載」 vs 「分享」
 *   - 失敗時自動 fallback
 */
export async function savePhotoToAlbum(
  opts: SavePhotoOptions,
): Promise<SaveResult> {
  const filename = `${opts.filename ?? "chito-photo"}-${Date.now()}.jpg`;

  // 強制 download mode（debug 用）
  if (opts.forceMethod === "download") {
    return downloadFallback(opts.url, filename);
  }

  // 嘗試 Web Share with files
  if (
    opts.forceMethod === "share" ||
    isMobileWithShare()
  ) {
    try {
      const file = await urlToFile(opts.url, filename);
      const canShareFiles =
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          title: opts.title ?? "CHITO 紀念照",
          text: opts.text,
          files: [file],
        });
        return { success: true, method: "share-with-files" };
      }

      // canShare 不支援 files → 用 url-only share（少數舊裝置）
      await navigator.share({
        title: opts.title ?? "CHITO 紀念照",
        text: opts.text,
        url: opts.url,
      });
      return { success: true, method: "share-url-only" };
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "AbortError") {
        // 使用者主動取消 → 不算失敗
        return {
          success: false,
          method: "none",
          errorReason: "abort",
        };
      }
      // 其他錯誤 → 走 fallback
      console.warn("[photo-save] share failed, fallback to download:", err);
    }
  }

  // Fallback: 下載
  return downloadFallback(opts.url, filename);
}

/**
 * Fallback：用 `<a download>` 觸發瀏覽器下載
 */
async function downloadFallback(
  url: string,
  filename: string,
): Promise<SaveResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        success: false,
        method: "none",
        errorReason: "fetch-failed",
      };
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    return { success: true, method: "download" };
  } catch (err) {
    console.error("[photo-save] download fallback failed:", err);
    return {
      success: false,
      method: "none",
      errorReason: "unknown",
    };
  }
}

/**
 * 給 UI 顯示對應 toast 訊息
 */
export function getSaveToastMessage(result: SaveResult): {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
} {
  if (result.errorReason === "abort") {
    return { title: "已取消", description: "" };
  }

  if (!result.success) {
    return {
      title: "保存失敗",
      description: "請長按圖片 → 儲存到相簿",
      variant: "destructive",
    };
  }

  switch (result.method) {
    case "share-with-files":
      return {
        title: "📱 已開啟分享",
        description: "點「儲存圖片」存到相簿",
      };
    case "share-url-only":
      return {
        title: "已分享連結",
        description: "建議使用桌機下載完整圖片",
      };
    case "download":
      return {
        title: "✅ 下載完成",
        description: "圖片已儲存到下載資料夾",
      };
    case "copy-url":
      return { title: "已複製連結" };
    default:
      return { title: "保存完成" };
  }
}
