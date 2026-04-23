import { useState, useEffect, type ReactNode } from "react";
import { ImageOff, Loader2 } from "lucide-react";
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

/** 預設的錯誤佔位元件 */
function DefaultFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-muted">
      <ImageOff className="h-8 w-8 text-muted-foreground" />
    </div>
  );
}

/** 載入中佔位元件（retry 中顯示，避免 broken img 可見） */
function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center w-full h-full bg-muted/50">
      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
    </div>
  );
}

/**
 * Cloudinary CDN 同步延遲 retry 策略（v2 — 擴大對付 CDN 30s 同步延遲）：
 * 1s → 2.5s → 5s → 8s → 15s（總等待 31.5s）
 * 超過 5 次失敗才顯示 fallback
 *
 * 背景：Cloudinary upload 完成後，邊緣節點可能需要 10-30 秒全球同步。
 * 使用者不該因為「前幾秒剛上傳」就看到破圖。
 */
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2500, 5000, 8000, 15000];

/**
 * 優化圖片元件
 * - Cloudinary URL 自動附加變換參數
 * - 載入失敗自動重試 2 次（應付 Cloudinary CDN 同步延遲）
 * - 🆕 retry 期間隱藏破圖、顯示 loading，避免使用者看到破圖 icon
 * - 統一錯誤處理
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
  const [isLoaded, setIsLoaded] = useState(false);

  // src 變更 → 重置所有狀態
  useEffect(() => {
    setHasError(false);
    setRetryCount(0);
    setIsLoaded(false);
  }, [src]);

  if (!src || hasError) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  const optimizedSrc = preset ? getOptimizedImageUrl(src, preset) : src;

  // retry 時加 cache-bust query
  const srcWithRetry = retryCount > 0
    ? `${optimizedSrc}${optimizedSrc.includes("?") ? "&" : "?"}_r=${retryCount}`
    : optimizedSrc;

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      // 🆕 立刻隱藏 img（設 isLoaded=false）+ setTimeout 後 retry
      setIsLoaded(false);
      setTimeout(() => {
        setRetryCount((c) => c + 1);
      }, RETRY_DELAYS[retryCount] ?? 5000);
      return;
    }
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // 🆕 未載入完成時，同時 render img（hidden）和 loading placeholder
  //   img 掛著讓瀏覽器去抓，但用 opacity:0 + absolute 把 broken 樣式蓋掉
  //   使用者只看到 loading spinner 直到圖真的載好
  return (
    <div className={`relative ${className.includes("w-") || className.includes("h-") ? "" : "w-full h-full"}`}>
      {!isLoaded && <LoadingPlaceholder />}
      <img
        src={srcWithRetry}
        alt={alt}
        className={className}
        loading={loading}
        onError={handleError}
        onLoad={handleLoad}
        key={`${src}-${retryCount}`}
        style={{
          opacity: isLoaded ? 1 : 0,
          position: isLoaded ? "static" : "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
