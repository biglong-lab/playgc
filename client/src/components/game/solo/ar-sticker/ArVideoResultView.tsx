// 🎬 ArVideoResultView — AR 錄影結果本地預覽（CHITO AR #2）
// 影片為 client 端 Blob（不上傳 server）：可預覽、存檔/分享、重拍、繼續。
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ArVideoResultViewProps {
  url: string;
  blob: Blob;
  mimeType: string;
  onRetake: () => void;
  onContinue: () => void;
}

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  return "mp4";
}

export default function ArVideoResultView({
  url,
  blob,
  mimeType,
  onRetake,
  onContinue,
}: ArVideoResultViewProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const filename = `chito-ar.${extFromMime(mimeType)}`;

  const handleSaveOrShare = async () => {
    setBusy(true);
    try {
      const file = new File([blob], filename, { type: mimeType });
      // 優先用系統分享（手機可存到相簿 / 傳給朋友）
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({ files: [file], title: "CHITO AR 錄影", text: "看看我的 AR 影片！" });
        return;
      }
      // fallback：直接下載
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: "已開始下載影片" });
    } catch (err) {
      // 使用者取消分享不算錯
      if (err instanceof Error && err.name !== "AbortError") {
        toast({ title: "存檔失敗", description: err.message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 gap-4" data-testid="ar-video-result">
      <div className="flex items-center gap-2 text-lg font-bold">
        <CheckCircle2 className="w-6 h-6 text-emerald-500" /> AR 錄影完成！
      </div>
      <video
        src={url}
        controls
        playsInline
        className="max-h-[55vh] w-auto rounded-lg border shadow-lg bg-black"
        data-testid="ar-video-player"
      />
      <div className="flex flex-wrap gap-2 justify-center">
        <Button onClick={handleSaveOrShare} disabled={busy} className="gap-2" data-testid="btn-ar-video-save">
          {typeof navigator !== "undefined" && (navigator as Navigator).share ? (
            <Share2 className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          存檔 / 分享
        </Button>
        <Button variant="outline" onClick={onRetake} className="gap-2" data-testid="btn-ar-video-retake">
          <RefreshCw className="w-4 h-4" /> 重拍
        </Button>
        <Button variant="secondary" onClick={onContinue} data-testid="btn-ar-video-continue">
          繼續 →
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        影片存在你的裝置上，點「存檔 / 分享」可儲存到相簿或傳給朋友。
      </p>
    </div>
  );
}
