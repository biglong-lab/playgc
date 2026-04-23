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
            <img
              src={currentUrl}
              alt=""
              className="w-16 h-16 object-cover rounded border"
            />
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
