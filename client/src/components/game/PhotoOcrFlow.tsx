// 🔍 PhotoOcrFlow — OCR 招牌任務（Google Vision）
//
// 資料流：
//   1. 玩家看到目標招牌文字 → 拍照
//   2. 上傳 Cloudinary → 取得 imageUrl
//   3. 呼叫 /api/ai/ocr-detect（Google Vision 辨識 + fuzzy match）
//   4. 成功 → 顯示辨識結果 + 下一步
//   5. 失敗 → 顯示信心度 + 可重試
//
// 合規：僅傳 Cloudinary 公開 URL、不做人臉辨識、不存個資

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ScanText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView,
  CameraView,
  PhotoPreview,
  UploadingView,
  VerifyingView,
} from "./photo-mission/PhotoViews";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoOcrFlowProps {
  config: PhotoMissionConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

interface OcrResult {
  matched: boolean;
  bestMatch: string | null;
  similarity: number;
  fullText: string;
  feedback: string;
  fallback?: boolean;
  errorCode?: string;
}

export default function PhotoOcrFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoOcrFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const ocr = config.ocrConfig;

  const [retryCount, setRetryCount] = useState(0);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const finishedRef = useRef(false);

  // 上傳照片
  const uploadMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await apiRequest("POST", "/api/cloudinary/player-photo", {
        imageData,
        gameId,
        sessionId,
      });
      return res.json() as Promise<{ url: string; publicId: string }>;
    },
  });

  // OCR 偵測
  const ocrMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await apiRequest("POST", "/api/ai/ocr-detect", {
        imageUrl,
        expectedTexts: ocr?.expectedTexts ?? [],
        fuzzyThreshold: ocr?.fuzzyThreshold ?? 0.7,
        gameId,
      });
      return res.json() as Promise<OcrResult>;
    },
  });

  // 主流程：拍照 → 上傳 → OCR
  useEffect(() => {
    const process = async () => {
      if (!camera.capturedImage) return;
      if (camera.mode !== "preview") return;

      try {
        camera.setMode("uploading");
        const uploaded = await uploadMutation.mutateAsync(camera.capturedImage);

        camera.setMode("verifying");
        const result = await ocrMutation.mutateAsync(uploaded.url);

        setOcrResult(result);

        if (!result.matched) {
          setRetryCount((c) => c + 1);
          const canRetry =
            (ocr?.allowRetryOnFail ?? true) &&
            retryCount < (ocr?.maxRetries ?? 3);

          if (canRetry) {
            toast({
              title: "😢 未能辨識目標文字",
              description: result.feedback,
              variant: "destructive",
            });
            camera.setMode("instruction");
            camera.setCapturedImage(null);
          } else {
            camera.setMode("ai_fail");
          }
          return;
        }

        // 成功
        camera.setMode("preview");
      } catch (err) {
        toast({
          title: "OCR 失敗",
          description: err instanceof Error ? err.message : "請檢查網路",
          variant: "destructive",
        });
        camera.setMode("instruction");
        camera.setCapturedImage(null);
      }
    };
    process();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.capturedImage, camera.mode]);

  // 繼續遊戲
  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rewardPoints = (config as unknown as { rewardPoints?: number })
      .rewardPoints;
    const rewardItems =
      (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const legacyPoints = config.onSuccess?.points;
    const legacyItem = config.onSuccess?.grantItem;

    const points = rewardPoints ?? legacyPoints ?? 30;
    const reward: { points?: number; items?: string[] } = { points };

    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(legacyItem ? [legacyItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;

    onComplete(reward);
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  // 防護：缺 ocrConfig
  if (!ocr || !ocr.expectedTexts || ocr.expectedTexts.length === 0) {
    return (
      <div className="p-6 text-center" data-testid="photo-ocr-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">
          photo_ocr 元件缺少目標文字設定
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          請管理員在編輯器填入至少一個目標文字
        </p>
      </div>
    );
  }

  // 成功畫面（matched + ocrResult 存在）
  if (ocrResult?.matched) {
    return (
      <div
        className="h-full w-full bg-background flex flex-col items-center justify-center p-4 gap-4"
        data-testid="photo-ocr-success"
      >
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-8 h-8" />
          <h2 className="text-xl font-bold">辨識成功！</h2>
        </div>

        <div className="max-w-md w-full bg-card rounded-lg shadow-lg overflow-hidden p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">命中目標</p>
            <p
              className="text-lg font-medium text-primary"
              data-testid="photo-ocr-best-match"
            >
              {ocrResult.bestMatch}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">相似度</p>
            <p className="text-sm font-medium">
              {Math.round(ocrResult.similarity * 100)}%
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">完整辨識文字</p>
            <p className="text-xs text-foreground break-all line-clamp-3">
              {ocrResult.fullText}
            </p>
          </div>
        </div>

        <Button
          onClick={handleContinue}
          className="w-full max-w-md"
          data-testid="btn-photo-ocr-continue"
        >
          繼續遊戲
        </Button>
      </div>
    );
  }

  // 相機流程
  if (camera.mode === "initializing") {
    return (
      <CameraInitializingView
        videoRef={camera.videoRef}
        onCancel={camera.cancelCamera}
      />
    );
  }
  if (camera.mode === "camera") {
    return (
      <CameraView
        videoRef={camera.videoRef}
        cameraReady={camera.cameraReady}
        fileInputRef={camera.fileInputRef}
        onCapture={camera.capturePhoto}
        onCancel={camera.cancelCamera}
        onRestart={camera.startCamera}
      />
    );
  }
  if (camera.mode === "uploading") return <UploadingView />;
  if (camera.mode === "preview") {
    return (
      <PhotoPreview
        imageSrc={camera.capturedImage!}
        onRetake={camera.retake}
        onSubmit={() => {
          /* 自動流程 — effect 處理 */
        }}
      />
    );
  }
  if (camera.mode === "verifying") return <VerifyingView />;
  if (camera.mode === "ai_fail") {
    return (
      <div
        className="p-6 text-center space-y-4"
        data-testid="photo-ocr-fail-final"
      >
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <p className="text-lg font-medium">未能辨識目標文字</p>
        <p className="text-sm text-muted-foreground">
          已用完重試次數（{ocr.maxRetries ?? 3} 次）
        </p>
        {ocrResult && (
          <div className="max-w-md mx-auto bg-muted/20 rounded p-3 text-xs text-left">
            <p className="text-muted-foreground mb-1">最後辨識結果：</p>
            <p className="break-all line-clamp-3">{ocrResult.fullText || "（無）"}</p>
            <p className="text-muted-foreground mt-2">
              最高相似度：{Math.round((ocrResult.similarity ?? 0) * 100)}%
            </p>
          </div>
        )}
        <Button
          onClick={handleContinue}
          variant="outline"
          data-testid="btn-photo-ocr-skip"
        >
          跳過此任務
        </Button>
      </div>
    );
  }

  // 🎨 預設：三段式佈局（h-full + flex-col + justify-center）
  //   - 使用 h-full 配合 GamePlay 的 <main flex-1> 自動填滿可用空間
  //   - 內容於可用空間垂直置中
  //   - 不使用 h-full w-full（會溢出 main 被 overflow-hidden 裁切）
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto"
      data-testid="photo-ocr-intro"
    >
      <div className="text-center space-y-2">
        <ScanText className="w-12 h-12 mx-auto text-primary" />
        <h2
          className="text-2xl font-bold"
          data-testid="photo-ocr-title"
        >
          {config.title || "招牌辨識任務"}
        </h2>
        {config.description && (
          <p className="text-muted-foreground text-sm px-4">
            {config.description}
          </p>
        )}
      </div>

      {/* 目標文字列表 */}
      <div className="max-w-md w-full bg-card rounded-lg p-4 space-y-2 shadow-md border">
        <p className="text-xs text-muted-foreground">找出以下任一文字的招牌：</p>
        <div className="flex flex-wrap gap-2">
          {ocr.expectedTexts.map((text, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
              data-testid={`photo-ocr-target-${idx}`}
            >
              {text}
            </span>
          ))}
        </div>
        {ocr.instruction && (
          <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
            {ocr.instruction}
          </p>
        )}
      </div>

      {/* 參考照片（可選）*/}
      {ocr.referenceImageUrl && (
        <div className="max-w-md w-full">
          <p className="text-xs text-muted-foreground mb-1">參考圖：</p>
          <img
            src={ocr.referenceImageUrl}
            alt="參考招牌"
            className="w-full rounded-lg object-cover max-h-40"
          />
        </div>
      )}

      {/* 拍照按鈕 */}
      <div className="max-w-md w-full">
        <Button
          onClick={camera.startCamera}
          size="lg"
          className="w-full gap-2 h-14 text-base font-semibold"
          data-testid="btn-photo-ocr-start"
        >
          <Camera className="w-5 h-5" />
          開始拍照
        </Button>
        {retryCount > 0 && (
          <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" />
            已重試 {retryCount} 次
          </p>
        )}
      </div>
    </div>
  );
}
