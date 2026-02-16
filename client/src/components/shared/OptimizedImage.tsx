import { useState, type ReactNode } from "react";
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
 * 優化圖片元件
 * - 自動 loading="lazy"
 * - Cloudinary URL 自動附加變換參數
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

  // 無 src 或載入錯誤 → 顯示 fallback
  if (!src || hasError) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  const optimizedSrc = preset
    ? getOptimizedImageUrl(src, preset)
    : src;

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
      onLoad={onLoad}
    />
  );
}
