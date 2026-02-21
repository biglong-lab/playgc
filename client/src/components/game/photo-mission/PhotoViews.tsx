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

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
// 拍照畫面
// ===========================================
interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onCapture: () => void;
  onCancel: () => void;
}

export function CameraView({
  videoRef,
  cameraReady,
  fileInputRef,
  onCapture,
  onCancel,
}: CameraViewProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-4/5 h-3/4 border-2 border-dashed border-primary/50 rounded-lg" />
        </div>
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-camera">
          取消
        </Button>
        <Button
          size="lg"
          onClick={onCapture}
          disabled={!cameraReady}
          className="w-20 h-20 rounded-full"
          data-testid="button-capture"
        >
          <Camera className="w-8 h-8" />
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-gallery"
        >
          <Image className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-2">
        將拍攝對象對準框內，然後按下快門
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
        <p className="text-lg font-medium">AI 驗證中...</p>
        <p className="text-sm text-muted-foreground">正在分析照片內容</p>
      </div>
    </div>
  );
}
