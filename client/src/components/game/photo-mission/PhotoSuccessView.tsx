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
import { CheckCircle2, Download, Share2, ImageOff, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { shareUrl, makeDownloadFilename } from "@/lib/share-photo";
import {
  savePhotoToAlbum,
  getSaveToastMessage,
  isMobileWithShare,
} from "@/lib/photo-save";

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

  // 🆕 主要動作：一鍵保存到手機相簿
  // 失敗 fallback：開全螢幕燈箱讓使用者長按存圖
  const [showLightbox, setShowLightbox] = useState(false);

  const handleSaveToAlbum = async () => {
    const result = await savePhotoToAlbum({
      url: imageUrl,
      filename: downloadPrefix,
      title: "CHITO 紀念照",
      text: "看看我的遊戲紀念！",
    });
    const msg = getSaveToastMessage(result);

    // 失敗或 share-url-only / open-tab → 開燈箱讓使用者直接長按
    if (
      !result.success ||
      result.method === "share-url-only" ||
      result.method === "open-tab"
    ) {
      setShowLightbox(true);
      return;
    }

    if (msg.title) toast(msg);
  };

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
  const isMobile = isMobileWithShare();

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

        {/* 圖片 — 失敗時顯示 fallback 不是破圖 */}
        <div className="w-full rounded-lg shadow-lg overflow-hidden bg-card border">
          {imageError ? (
            <div className="w-full aspect-square flex flex-col items-center justify-center gap-3 bg-muted/30 p-6">
              <ImageOff className="w-16 h-16 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground text-center">
                紀念照載入失敗
              </p>
              <p className="text-xs text-muted-foreground text-center">
                可能是網路問題，不影響遊戲進度
              </p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="遊戲紀念照"
              className="w-full h-auto block"
              data-testid="photo-success-image"
              loading="eager"
              onError={() => setImageError(true)}
            />
          )}
        </div>

        {/* 操作按鈕 — 圖片失敗時只顯示「繼續」，免得按無效下載/分享 */}
        {imageError ? (
          <Button
            onClick={onContinue}
            size="lg"
            className="w-full gap-1 font-semibold"
            data-testid="btn-photo-success-continue"
          >
            繼續遊戲 →
          </Button>
        ) : (
          <div className="w-full space-y-2">
            {/* 🆕 主要動作：保存到相簿（最大、綠色突出）*/}
            <Button
              onClick={handleSaveToAlbum}
              size="lg"
              className="w-full gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="btn-photo-success-save-album"
            >
              <ImageDown className="w-5 h-5" />
              {isMobile ? "保存到相簿" : "下載圖片"}
            </Button>

            {/* 次要動作：分享 + 繼續 */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                onClick={handleShare}
                variant="outline"
                className="gap-1"
                data-testid="btn-photo-success-share"
              >
                <Share2 className="w-4 h-4" /> 分享給朋友
              </Button>
              <Button
                onClick={onContinue}
                className="gap-1 font-semibold"
                data-testid="btn-photo-success-continue"
              >
                繼續 →
              </Button>
            </div>

            {/* 桌機備援：直接下載連結（隱藏在小字）*/}
            {!isMobile && (
              <a
                href={imageUrl}
                download={downloadFilename}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-muted-foreground text-center hover:text-foreground underline"
                data-testid="btn-photo-success-download-fallback"
              >
                <Download className="w-3 h-3 inline mr-1" />
                若上方按鈕無效，點此直接下載
              </a>
            )}
          </div>
        )}

        {/* iOS Safari 提示 — 只在手機顯示 */}
        {isMobile && !imageError && (
          <p className="text-xs text-muted-foreground text-center max-w-xs pt-2">
            💡 點「保存到相簿」會跳出系統分享 → 選「儲存圖片」
          </p>
        )}
      </div>
    </div>
  );
}
