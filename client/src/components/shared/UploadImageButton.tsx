// 📸 共用圖片上傳按鈕
//
// 接受任何管理端 cloudinary 端點（body: { imageData }），成功後 callback URL
// 典型用法：場域封面/Logo、遊戲封面
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface UploadImageButtonProps {
  /** POST 目標，body 會是 `{ imageData: "data:image/..." }` */
  endpoint: string;
  /** 目前的 URL（用於顯示縮圖） */
  currentUrl?: string;
  /** 上傳完成後呼叫，拿到 cloudinary secure URL */
  onUploaded: (url: string) => void;
  /** 按鈕文字 */
  label?: string;
  /** 顯示在按鈕下方的提示文字（如建議尺寸） */
  hint?: string;
  /** 最大檔案大小（bytes），預設 5MB */
  maxBytes?: number;
  /** testId 前綴 */
  testId?: string;
}

/** 把 File 轉 base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 單次圖片預載（用 Image 物件 onload/onerror，比 fetch 可靠且沒 CORS 問題）
 */
function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = ""; // abort
      resolve(false);
    }, 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

/**
 * 輪詢等 Cloudinary CDN 全球同步完成（最多 20 秒）
 * 背景：upload API 完成時 CDN 邊緣節點可能還沒同步，如果馬上 call onUploaded
 *      UI 拿到 URL 去載會 404，然後被瀏覽器 cache「失敗狀態」造成破圖循環
 */
async function waitForCdnSync(url: string, maxAttempts = 10): Promise<boolean> {
  // 第一次 0ms 就試（上傳後偶爾 CDN 已同步）
  // 之後每次間隔 2s，共 20 秒
  for (let i = 0; i < maxAttempts; i++) {
    // 用不同的 cache-bust query 避免瀏覽器重用失敗 response
    const probeUrl = url + (url.includes("?") ? "&" : "?") + `_probe=${Date.now()}${i}`;
    if (await preloadImage(probeUrl)) return true;
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

export function UploadImageButton({
  endpoint,
  currentUrl,
  onUploaded,
  label = "上傳圖片",
  hint,
  maxBytes = 5 * 1024 * 1024,
  testId,
}: UploadImageButtonProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 選完後清空 input 才能重選同一個檔案
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "請選擇圖片檔案", variant: "destructive" });
      return;
    }
    if (file.size > maxBytes) {
      toast({
        title: "圖片太大",
        description: `最大 ${(maxBytes / 1024 / 1024).toFixed(1)} MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetchWithAdminAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ imageData: base64 }),
      }) as { url?: string; coverImageUrl?: string };

      // 兼容兩種 response 格式（/cloudinary-cover 回 coverImageUrl，場域 endpoint 回 url）
      const uploadedUrl = res.url || res.coverImageUrl;
      if (!uploadedUrl) throw new Error("伺服器沒有回傳 URL");

      onUploaded(uploadedUrl);
      toast({ title: "上傳成功" });
    } catch (err) {
      toast({
        title: "上傳失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {currentUrl && (
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded border overflow-hidden">
              <OptimizedImage
                src={currentUrl}
                alt="預覽"
                preset="thumbnail"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <button
              type="button"
              onClick={() => onUploaded("")}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center hover:scale-110 transition-transform"
              title="移除圖片"
              aria-label="移除圖片"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            data-testid={testId ? `${testId}-file` : undefined}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
            data-testid={testId}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? "上傳中..." : label}
          </Button>
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
