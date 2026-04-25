// 📸 統一照片保存工具 — 所有 photo flow 共用
//
// 設計原則：
//   1. 預設目標 = 手機相簿（最順暢的使用者體驗）
//   2. iOS / Android：用 navigator.share + File → 系統 share sheet 內可一鍵「儲存到相簿」
//   3. Desktop：fallback `<a download>` 到下載資料夾
//   4. 多層 fallback：fetch → image+canvas → share URL only → open new tab
//   5. 所有錯誤都吞掉，回傳 enum result 給 UI 顯示對應 toast

export type SaveTarget = "album" | "share" | "download";

export interface SaveResult {
  success: boolean;
  /** 實際採用的方式（給 UI 顯示對應提示）*/
  method:
    | "share-with-files"
    | "share-url-only"
    | "download"
    | "download-canvas"
    | "open-tab"
    | "copy-url"
    | "none";
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
 */
export function isMobileWithShare(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod|android/.test(ua) ||
    (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1)
  );
}

/**
 * 把 URL 轉成 Blob — 多層 fallback
 *   1. fetch URL（最快，但可能 CORS）
 *   2. img + canvas.toBlob（避開 fetch CORS，需要圖片本身允許 cross-origin）
 *   3. data: URL → 直接 base64 解析
 */
async function urlToBlob(url: string): Promise<Blob> {
  // 1. data URL 直接解析
  if (url.startsWith("data:")) {
    const [head, b64] = url.split(",");
    const mime = head.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // 2. 嘗試 fetch
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) return blob;
    }
  } catch (err) {
    console.warn("[photo-save] fetch 失敗，改用 image canvas:", err);
  }

  // 3. fallback: 用 <img> + canvas.toBlob
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
            } else {
              reject(new Error("canvas.toBlob returned null"));
            }
          },
          "image/jpeg",
          0.9,
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

async function urlToFile(url: string, filename: string): Promise<File> {
  const blob = await urlToBlob(url);
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

/**
 * 從 URL 偵測副檔名（用於 multi-file save 時保留原格式）
 * 支援 .gif / .jpg / .jpeg / .png / .webp / .mp4
 *   - 沒副檔名 → 預設 .jpg
 *   - data URL → 從 mime type 推
 */
export function detectExtension(url: string): string {
  if (!url) return "jpg";
  if (url.startsWith("data:")) {
    const mime = url.match(/data:([^;]+)/)?.[1] || "";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("mp4")) return "mp4";
    return "jpg";
  }
  const match = url.match(/\.(gif|jpe?g|png|webp|mp4)(\?|$)/i);
  if (match) {
    const ext = match[1].toLowerCase();
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}

/**
 * 主入口：保存照片（預設優先存到手機相簿）
 *
 * Fallback 順序：
 *   📱 手機：share with files → share URL only → open new tab + 提示長按
 *   💻 桌機：browser download
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
  if (opts.forceMethod === "share" || isMobileWithShare()) {
    // 1. 嘗試 share with files
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
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "AbortError") {
        return { success: false, method: "none", errorReason: "abort" };
      }
      console.warn("[photo-save] share-with-files 失敗，嘗試其他方式:", err);
    }

    // 2. fallback: share URL only（iOS share sheet 仍可儲存圖片）
    try {
      await navigator.share({
        title: opts.title ?? "CHITO 紀念照",
        text: opts.text,
        url: opts.url,
      });
      return { success: true, method: "share-url-only" };
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "AbortError") {
        return { success: false, method: "none", errorReason: "abort" };
      }
      console.warn("[photo-save] share-url 失敗，改 open new tab:", err);
    }

    // 3. fallback: 開新 tab 讓使用者長按存圖
    try {
      window.open(opts.url, "_blank", "noopener,noreferrer");
      return { success: true, method: "open-tab" };
    } catch {
      // 全部失敗
    }
  }

  // 4. Desktop fallback: 下載
  return downloadFallback(opts.url, filename);
}

/**
 * Fallback：用 `<a download>` 觸發瀏覽器下載
 *   多層保護：fetch → urlToBlob (含 canvas) → 直接 <a href> 開新頁
 */
async function downloadFallback(
  url: string,
  filename: string,
): Promise<SaveResult> {
  // 1. 嘗試 fetch + URL.createObjectURL（最乾淨）
  try {
    const blob = await urlToBlob(url);
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
    console.warn("[photo-save] download blob 失敗，直接 a href:", err);
  }

  // 2. fallback: 直接用 a href（瀏覽器會嘗試下載或開新頁）
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, method: "download" };
  } catch (err) {
    console.error("[photo-save] download fallback 完全失敗:", err);
    return {
      success: false,
      method: "none",
      errorReason: "fetch-failed",
    };
  }
}

/**
 * 🆕 一次保存多張照片到相簿（手機相簿最順暢）
 *
 * UX 流程：
 *   📱 iOS / Android：navigator.share({ files: [...] }) → 系統 share sheet 一鍵全部存
 *   💻 桌機：逐張下載（瀏覽器自動觸發多次下載）
 *
 * 不再用 ZIP（手機極不友善 — 還要解壓縮）
 */
export async function savePhotosToAlbum(opts: {
  urls: string[];
  filenamePrefix?: string;
  title?: string;
  text?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<SaveResult & { savedCount?: number }> {
  const total = opts.urls.length;
  if (total === 0) {
    return { success: false, method: "none", errorReason: "unknown" };
  }
  const prefix = opts.filenamePrefix ?? "chito";

  // 嘗試 Web Share with ALL files
  if (isMobileWithShare()) {
    try {
      // 平行 fetch 所有 blob（限制 5 個並發避免裝置卡頓）
      const files: File[] = [];
      const concurrency = 5;
      for (let i = 0; i < total; i += concurrency) {
        const batch = opts.urls.slice(i, i + concurrency);
        const batchFiles = await Promise.all(
          batch.map(async (url, idx) => {
            const filename = `${prefix}-${String(i + idx + 1).padStart(2, "0")}.jpg`;
            try {
              return await urlToFile(url, filename);
            } catch (e) {
              console.warn(`[photo-save] file ${filename} 載入失敗:`, e);
              return null;
            }
          }),
        );
        files.push(...batchFiles.filter((f): f is File => !!f));
        opts.onProgress?.(files.length, total);
      }

      if (files.length === 0) {
        throw new Error("所有圖片載入失敗");
      }

      const canShareFiles =
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files });

      if (canShareFiles) {
        await navigator.share({
          title: opts.title ?? "CHITO 紀念照",
          text: opts.text ?? `${files.length} 張紀念照`,
          files,
        });
        return {
          success: true,
          method: "share-with-files",
          savedCount: files.length,
        };
      }

      // canShare 多檔不支援 → 逐張保存
      console.warn("[photo-save] canShare files 不支援，逐張保存");
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "AbortError") {
        return { success: false, method: "none", errorReason: "abort" };
      }
      console.warn("[photo-save] 多檔分享失敗，改逐張:", err);
    }
  }

  // Fallback: 逐張保存（手機 → 逐張 share / 桌機 → 逐張 download）
  let savedCount = 0;
  for (let i = 0; i < total; i++) {
    const filename = `${prefix}-${String(i + 1).padStart(2, "0")}`;
    const result = await savePhotoToAlbum({
      url: opts.urls[i],
      filename,
      title: opts.title,
      forceMethod: isMobileWithShare() ? "share" : "download",
    });
    if (result.success) savedCount++;
    if (result.errorReason === "abort") break;
    opts.onProgress?.(i + 1, total);
    // 給瀏覽器喘口氣，避免一次性下載被 popup blocker 擋
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return {
    success: savedCount > 0,
    method: "download",
    savedCount,
  };
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
    return { title: "已取消" };
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
        title: "📱 已開啟分享",
        description: "在分享頁長按圖片 → 儲存圖片",
      };
    case "open-tab":
      return {
        title: "已開啟圖片",
        description: "長按圖片即可存到相簿",
      };
    case "download":
    case "download-canvas":
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
