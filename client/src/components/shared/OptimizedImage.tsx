import { useState, useEffect, useMemo, type ReactNode } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import {
  getOptimizedImageUrl,
  buildSrcSet,
  SIZES_PRESETS,
  type ImagePreset,
} from "@/lib/image-utils";
import { useNetworkQuality, withNetworkQuality } from "@/hooks/useNetworkQuality";

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
  /**
   * 🆕 自訂 sizes attribute（不傳 = 用 preset 預設）
   * 例：sizes="(max-width: 768px) 100vw, 600px"
   */
  readonly sizes?: string;
  /** 🆕 是否停用 srcSet（預設 false，啟用多解析度）*/
  readonly disableSrcSet?: boolean;
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

// 📦 模組層級常數：preset 對應 width/height（防 CLS 用，每張 img 都查同份）
const PRESET_DIMS: Record<string, { w: number; h: number }> = {
  card: { w: 800, h: 500 },
  cover: { w: 1600, h: 800 },
  icon: { w: 160, h: 160 },
  thumbnail: { w: 400, h: 400 },
};

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
  sizes,
  disableSrcSet = false,
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

  const networkInfo = useNetworkQuality();

  // ⚡ useMemo：避免每次 render 都重算 URL（高頻 re-render 場景，如圖片列表）
  // ⚠️ 必須在 early return 之前（React hooks rules）
  // 🆕 弱網 / Data Saver 自動降低 Cloudinary 品質（q_auto:low / q_auto:eco）
  const optimizedSrc = useMemo(() => {
    const base = preset && src ? getOptimizedImageUrl(src, preset) : src ?? "";
    return withNetworkQuality(base, networkInfo);
  }, [src, preset, networkInfo]);

  // 🆕 多解析度 srcSet（給 retina / 高 DPR 螢幕用更大版本）
  // retry > 0 時不用 srcSet（避免 cache-bust 跟 srcSet 衝突）
  const enableSrcSet = preset && !disableSrcSet && retryCount === 0;
  const srcSetStr = useMemo(
    () => (enableSrcSet && src ? buildSrcSet(src, preset) : ""),
    [enableSrcSet, src, preset],
  );

  // 🚫 hooks 後才能 early return
  if (!src || hasError) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  const sizesStr = sizes ?? (enableSrcSet ? SIZES_PRESETS[preset] : undefined);

  // 🆕 width/height attribute 防 CLS（用模組層級 PRESET_DIMS，每 render 不重建 Object）
  const dims = preset ? PRESET_DIMS[preset] : undefined;

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

  // 🆕 跨域圖片（Cloudinary / 外部 URL）加 crossOrigin="anonymous"，讓 response 為 CORS
  //   response（非 opaque），Service Worker 才能真正 cache 有內容的 response，
  //   避免 CacheFirst 策略下讀到 0-byte opaque response 造成破圖。
  const isCrossOrigin = /^https?:\/\//.test(srcWithRetry) &&
    (typeof window === "undefined" || !srcWithRetry.startsWith(window.location.origin));

  // 🆕 未載入完成時，同時 render img（hidden）和 loading placeholder
  //   img 掛著讓瀏覽器去抓，但用 opacity:0 + absolute 把 broken 樣式蓋掉
  //   使用者只看到 loading spinner 直到圖真的載好
  //
  // 🐛 修復：wrapper div 永遠 w-full h-full，避免 className 含 h- 時 wrapper 沒設高度
  // 造成圖片只佔自然尺寸（下方留白）— 影響 text_card 圖片在上模式
  return (
    <div className="relative w-full h-full">
      {!isLoaded && <LoadingPlaceholder />}
      <img
        src={srcWithRetry}
        srcSet={srcSetStr || undefined}
        sizes={sizesStr}
        alt={alt}
        className={className}
        loading={loading}
        // 🆕 預設 decoding=async 讓主執行緒不被解碼阻塞
        decoding="async"
        // 🆕 width/height attribute 防 CLS（即使 CSS 蓋掉，aspect-ratio 仍預先計算）
        width={dims?.w}
        height={dims?.h}
        crossOrigin={isCrossOrigin ? "anonymous" : undefined}
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
