// 🎉 共用成功頁 — 所有 photo_* 元件拍照成功後的統一 UI
//
// 解決的問題：
//   - 原本 8 個元件各自寫 success 畫面，容易歪斜、文案不一、按鈕排版不同
//   - 下載用 fetch blob 遇 CORS 失敗
//   - 分享用 fetch blob + file 在 iOS Safari 偶爾掛
//
// 新方案：
//   - 單一來源 PhotoSuccessView
//   - 下載用 <a download>（跨瀏覽器最穩）
//   - 分享優先 Web Share URL（不 fetch blob）
//   - max-w-md + mx-auto + overflow-y-auto 確保永不歪斜

import { useState } from "react";
import { CheckCircle2, Download, Share2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { shareUrl, makeDownloadFilename } from "@/lib/share-photo";

export interface PhotoSuccessViewProps {
  /** 最終照片 URL（通常是 Cloudinary URL 或合成紀念照）*/
  imageUrl: string;
  /** 成功文字標題，如「拍照成功！」「AR 拍照完成！」 */
  title?: string;
  /** 可選的副說明（如「已加入相簿」或「相似度 92%」）*/
  subtitle?: string;
  /** 下載檔名 prefix（不含副檔名，如 "chito-ar"、"chito-burst"）*/
  downloadPrefix?: string;
  /** 點「繼續遊戲」回調 */
  onContinue: () => void;
  /** data-testid（各元件可自訂）*/
  testId?: string;
}

export default function PhotoSuccessView({
  imageUrl,
  title = "拍照完成！",
  subtitle,
  downloadPrefix = "chito",
  onContinue,
  testId = "photo-success-view",
}: PhotoSuccessViewProps) {
  const { toast } = useToast();
  const [imageError, setImageError] = useState(false);

  const handleShare = async () => {
    try {
      const result = await shareUrl({
        url: imageUrl,
        title: "CHITO 紀念照",
        text: "看看我的遊戲紀念！",
        onCopied: () => toast({ title: "✅ 連結已複製", description: "可貼到 LINE / FB" }),
        onOpenedTab: () => toast({ title: "已開啟圖片", description: "長按可儲存到相簿" }),
      });
      if (result === "shared") {
        // Web Share 成功（無需 toast，使用者看到系統分享表單）
      }
    } catch {
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  const downloadFilename = makeDownloadFilename(imageUrl, downloadPrefix);

  return (
    <div
      className="w-full min-h-full overflow-y-auto bg-background"
      data-testid={testId}
    >
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-4">
        {/* 成功標題 */}
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">{title}</h2>
        </div>

        {subtitle && (
          <p className="text-sm text-muted-foreground text-center">{subtitle}</p>
        )}

        {/* 圖片 */}
        <div className="w-full rounded-lg shadow-lg overflow-hidden bg-card border">
          <img
            src={imageUrl}
            alt="遊戲紀念照"
            className="w-full h-auto block"
            data-testid="photo-success-image"
            loading="eager"
          />
        </div>

        {/* 操作按鈕（3 等寬）*/}
        <div className="grid grid-cols-3 gap-2 w-full">
          {/* 下載：用 <a download> 讓瀏覽器原生處理（跨瀏覽器最穩定）*/}
          <a
            href={imageUrl}
            download={downloadFilename}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 h-10 rounded-md border border-input bg-background text-foreground hover:bg-accent text-sm transition-colors"
            data-testid="btn-photo-success-download"
          >
            <Download className="w-4 h-4" /> 下載
          </a>

          {/* 分享：優先 Web Share URL，不 fetch blob */}
          <Button
            onClick={handleShare}
            variant="outline"
            className="gap-1"
            data-testid="btn-photo-success-share"
          >
            <Share2 className="w-4 h-4" /> 分享
          </Button>

          {/* 繼續遊戲 */}
          <Button
            onClick={onContinue}
            className="gap-1 font-semibold"
            data-testid="btn-photo-success-continue"
          >
            繼續 →
          </Button>
        </div>

        {/* iOS Safari 小提示 */}
        <p className="text-xs text-muted-foreground text-center max-w-xs pt-2">
          💡 iOS 用戶：若下載無效，可長按圖片 → 儲存到相簿
        </p>
      </div>
    </div>
  );
}
