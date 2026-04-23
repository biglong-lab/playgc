import { useState, useEffect, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { getOptimizedImageUrl, type ImagePreset } from "@/lib/image-utils";

interface OptimizedImageProps {
  /** 圖片 URL（支援 Cloudinary 自動優化） */
  readonly src: string | null | undefined;
  /** 圖片替代文字 */
  readonly alt: string;
  /** Cloudinary 變換預設 */
  readonly preset?: ImagePreset;
  /** 自訂 CSS 類別 */
  readonly className?: string;
  /** 載入策略（預設 lazy） */
  readonly loading?: "lazy" | "eager";
  /** 圖片載入失敗時顯示的內容 */
  readonly fallback?: ReactNode;
  /** 額外的錯誤回呼 */
  readonly onError?: () => void;
  /** 額外的載入完成回呼 */
  readonly onLoad?: () => void;
}

/** 預設的圖片錯誤佔位元件 */
function DefaultFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-muted">
      <ImageOff className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

/**
 * 新上傳圖片 CDN 同步延遲的 retry 策略：
 * Cloudinary 回傳 secure_url 後，edge CDN 偶有 1-3 秒同步延遲
 * 第一次失敗 → 等 1.5s 再試
 * 第二次失敗 → 等 3s 再試
 * 第三次失敗 → 顯示 fallback
 */
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1500, 3000];

/**
 * 優化圖片元件
 * - 自動 loading="lazy"
 * - Cloudinary URL 自動附加變換參數
 * - 🆕 載入失敗自動重試 2 次（應付 Cloudinary CDN 同步延遲 / 剛上傳破圖）
 * - 統一錯誤處理（顯示 fallback）
 */
export default function OptimizedImage({
  src,
  alt,
  preset,
  className = "",
  loading = "lazy",
  fallback,
  onError,
  onLoad,
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // src 變更時重置錯誤與 retry 計數（例如重新上傳後拿到新 URL）
  useEffect(() => {
    setHasError(false);
    setRetryCount(0);
  }, [src]);

  // 無 src 或超過 retry 上限 → 顯示 fallback
  if (!src || hasError) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  const optimizedSrc = preset
    ? getOptimizedImageUrl(src, preset)
    : src;

  // retry 時加 cache-bust query，繞過 browser memory cache 的 404
  const srcWithRetry = retryCount > 0
    ? `${optimizedSrc}${optimizedSrc.includes("?") ? "&" : "?"}_r=${retryCount}`
    : optimizedSrc;

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      // 🔄 CDN 可能還沒同步，延遲後再試
      setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, RETRY_DELAYS[retryCount] ?? 3000);
      return;
    }
    setHasError(true);
    onError?.();
  };

  return (
    <img
      src={srcWithRetry}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
      onLoad={onLoad}
      // key 變化強制 React 重建 <img> 元素，避免 browser cache 卡住
      key={`${src}-${retryCount}`}
    />
  );
}
