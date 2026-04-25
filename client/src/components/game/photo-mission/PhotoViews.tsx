import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Image,
  XCircle,
  SkipForward,
} from "lucide-react";
import type { PhotoMissionConfig } from "@shared/schema";
import { useCameraOverlayMode } from "@/hooks/useCameraOverlayMode";

// ===========================================
// 指令畫面 - 顯示任務說明 + 拍照/相簿按鈕
// ===========================================
interface InstructionViewProps {
  config: PhotoMissionConfig;
  cameraError: string | null;
  onStartCamera: () => void;
  onClearError: () => void;
  onOpenGallery: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function InstructionView({
  config,
  cameraError,
  onStartCamera,
  onClearError,
  onOpenGallery,
  fileInputRef,
  onFileUpload,
}: InstructionViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-xl font-display font-bold text-center mb-4">
            {config.title || "拍照任務"}
          </h2>

          <div className="bg-accent/50 border border-border rounded-lg p-4 mb-6">
            <p className="text-sm font-medium mb-2">任務說明:</p>
            <p className="text-muted-foreground">
              {config.instruction ||
                config.prompt ||
                config.description ||
                "請拍攝符合要求的照片"}
            </p>
          </div>

          {config.targetKeywords && config.targetKeywords.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-2">需要拍攝:</p>
              <div className="flex flex-wrap gap-2">
                {config.targetKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {cameraError && (
            <CameraErrorBanner
              error={cameraError}
              onRetry={() => {
                onClearError();
                onStartCamera();
              }}
            />
          )}

          <div className="space-y-3">
            <Button
              onClick={onStartCamera}
              className="w-full gap-2"
              data-testid="button-open-camera"
            >
              <Camera className="w-4 h-4" />
              開啟相機
            </Button>

            <Button
              variant="outline"
              onClick={onOpenGallery}
              className="w-full gap-2"
              data-testid="button-upload-photo"
            >
              <Image className="w-4 h-4" />
              從相簿選擇
            </Button>

            {/* 從相簿選擇：不加 capture 屬性，iOS Safari 才會顯示「相簿 / 拍照」選單 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileUpload}
              className="hidden"
            />
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            提示: 請確保允許瀏覽器使用相機權限，並在光線充足的環境拍攝
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================
// 相機錯誤橫幅
// ===========================================
function CameraErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="text-left">
          <p className="text-sm text-destructive font-medium mb-1">相機問題</p>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-3 w-full gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        重試
      </Button>
    </div>
  );
}

// ===========================================
// 相機初始化畫面
// ===========================================
interface CameraInitializingViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onCancel: () => void;
}

export function CameraInitializingView({
  videoRef,
  onCancel,
}: CameraInitializingViewProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg">正在啟動相機...</p>
            <p className="text-sm text-white/60 mt-2">請允許相機權限</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-init">
          取消
        </Button>
      </div>
    </div>
  );
}

// ===========================================
// 拍照畫面（沉浸式 fixed full-screen）
// ===========================================
interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCapture: () => void;
  onCancel: () => void;
  /** 手動重啟相機（載入失敗時救急用）*/
  onRestart?: () => void;
  /** 🆕 切換前後鏡頭（若提供則顯示按鈕）*/
  onSwitchCamera?: () => void;
  facingMode?: "user" | "environment";
}

export function CameraView({
  videoRef,
  cameraReady,
  fileInputRef,
  onCapture,
  onCancel,
  onRestart,
  onSwitchCamera,
  facingMode = "environment",
}: CameraViewProps) {
  const isMirror = facingMode === "user";
  // 🆕 拍照時告訴全域元件「我在拍照」→ Walkie Pill 等浮動 UI 自動隱藏
  useCameraOverlayMode(true);
  return (
    // 🎨 fixed inset-0 z-50 蓋過 GamePlay header/footer 全螢幕沉浸式
    <div className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="camera-view-fullscreen">
      <div className="flex-1 relative bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: isMirror ? "scaleX(-1)" : undefined }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-4/5 h-3/4 border-2 border-dashed rounded-lg transition-colors ${
              cameraReady ? "border-primary/50" : "border-amber-500/70"
            }`}
          />
        </div>


        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="text-white/90 text-sm">相機載入中...</p>
            {onRestart && (
              <button
                onClick={onRestart}
                className="mt-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/30 hover:bg-white/20"
              >
                🔄 載入太久？點此重啟相機
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="py-4 px-4 flex items-center justify-center gap-6 bg-black"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-camera"
          className="min-h-12 px-5 bg-white/10 border-white/30 text-white hover:bg-white/20"
        >
          取消
        </Button>
        {/* 📱 快門 80px 大圓形 — disabled 時明顯變灰 + 縮小 */}
        <Button
          size="lg"
          onClick={onCapture}
          disabled={!cameraReady}
          className={`w-20 h-20 md:w-20 md:h-20 rounded-full shadow-lg active:scale-95 transition-all bg-white text-black hover:bg-white/90 ${
            !cameraReady ? "opacity-30 scale-90 cursor-not-allowed" : ""
          }`}
          data-testid="button-capture"
          title={!cameraReady ? "相機載入中，請稍候" : "按下拍照"}
        >
          <Camera className="w-9 h-9" />
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-gallery"
          className="min-h-12 w-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
          aria-label="從相簿選擇"
        >
          <Image className="w-5 h-5" />
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-2">
        {cameraReady
          ? "將拍攝對象對準框內，然後按下快門"
          : "⏳ 相機啟動中，快門暫不可用..."}
      </p>
    </div>
  );
}

// ===========================================
// 照片預覽畫面
// ===========================================
interface PhotoPreviewProps {
  imageSrc: string;
  onRetake: () => void;
  onSubmit: () => void;
}

export function PhotoPreview({
  imageSrc,
  onRetake,
  onSubmit,
}: PhotoPreviewProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
        <img src={imageSrc} alt="Captured" className="w-full h-full object-contain" />
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <Button variant="outline" onClick={onRetake} className="gap-2" data-testid="button-retake">
          <RotateCcw className="w-4 h-4" />
          重拍
        </Button>
        <Button onClick={onSubmit} className="gap-2" data-testid="button-submit-photo">
          <Check className="w-4 h-4" />
          確認上傳
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-2">
        確認照片清晰且符合任務要求
      </p>
    </div>
  );
}

// ===========================================
// 上傳中 / AI 驗證中 畫面
// ===========================================
export function UploadingView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium">上傳中...</p>
        <p className="text-sm text-muted-foreground">請稍候，不要離開此頁面</p>
      </div>
    </div>
  );
}

export function VerifyingView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-medium">AI 正在分析照片內容...</p>
        <p className="text-sm text-muted-foreground mt-1">請稍候，通常只需數秒</p>
      </div>
    </div>
  );
}

// ===========================================
// AI 驗證失敗畫面
// ===========================================
interface AiFailViewProps {
  feedback: string;
  detectedObjects: string[];
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onSkip: () => void;
}

export function AiFailView({
  feedback,
  detectedObjects,
  canRetry,
  retryCount,
  maxRetries,
  onRetry,
  onSkip,
}: AiFailViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>

          <h3 className="text-lg font-display font-bold text-center mb-2">
            照片驗證未通過
          </h3>

          <p className="text-sm text-muted-foreground text-center mb-4">
            {feedback}
          </p>

          {detectedObjects.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">AI 偵測到：</p>
              <div className="flex flex-wrap gap-1">
                {detectedObjects.map((obj, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {obj}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {canRetry && (
              <Button onClick={onRetry} className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                重新拍照（剩餘 {maxRetries - retryCount} 次）
              </Button>
            )}
            <Button
              variant={canRetry ? "outline" : "default"}
              onClick={onSkip}
              className="w-full gap-2"
            >
              <SkipForward className="w-4 h-4" />
              {canRetry ? "跳過此任務" : "繼續下一步"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
