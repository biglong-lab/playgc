import { useState, useRef, lazy, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PhotoMissionConfig } from "@shared/schema";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  InstructionView,
  CameraInitializingView,
  CameraView,
  PhotoPreview,
  UploadingView,
  VerifyingView,
  AiFailView,
} from "./photo-mission/PhotoViews";

// 🆕 v2 多模式拍照元件（lazy load，避免影響既有 free mode bundle）
const PhotoSpotFlow = lazy(() => import("./PhotoSpotFlow"));
const PhotoCompareFlow = lazy(() => import("./PhotoCompareFlow"));

interface PhotoMissionPageProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

interface AiVerifyResponse {
  verified: boolean;
  confidence: number;
  feedback: string;
  detectedObjects: string[];
  fallback?: boolean;
}

export default function PhotoMissionPage({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoMissionPageProps) {
  // 🆕 v2: 依 mode 分派到新 flow（保持既有 free mode 不受影響）
  if (config.mode === "spot") {
    return (
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">載入中...</div>}>
        <PhotoSpotFlow
          config={config}
          onComplete={onComplete}
          sessionId={sessionId}
          gameId={gameId}
        />
      </Suspense>
    );
  }
  // mode === 'compare' / 'team' / 'burst' 等後續輪次加入

  const { toast } = useToast();
  const camera = usePhotoCamera();
  const [aiRetryCount, setAiRetryCount] = useState(0);
  const [aiFeedback, setAiFeedback] = useState("");
  const [aiDetectedObjects, setAiDetectedObjects] = useState<string[]>([]);

  const maxRetries = config.maxAiRetries ?? 3;
  const canRetry = (config.allowRetryOnAiFail !== false) && aiRetryCount < maxRetries;

  const buildReward = (aiVerified: boolean) => {
    const basePoints = config.onSuccess?.points ?? (config.aiVerify ? 20 : 10);
    const reward: { points?: number; items?: string[] } = {
      points: aiVerified ? basePoints : 0,
    };
    if (aiVerified && config.onSuccess?.grantItem) {
      reward.items = [config.onSuccess.grantItem];
    }
    return reward;
  };

  // 防重複 onComplete：AI onError / onSuccess / skip 按鈕連點可能都呼叫 onComplete
  const finishedRef = useRef(false);
  const safeOnComplete = (reward: ReturnType<typeof buildReward>) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete(reward);
  };

  // AI 照片驗證
  const verifyMutation = useMutation({
    mutationFn: async (imageUrl: string): Promise<AiVerifyResponse> => {
      const response = await apiRequest("POST", "/api/ai/verify-photo", {
        imageUrl,
        targetKeywords: config.targetKeywords || [],
        instruction: config.instruction,
        confidenceThreshold: config.aiConfidenceThreshold ?? 0.6,
        gameId,
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.verified) {
        // AI 真的驗證通過 → 給滿分
        toast({
          title: "照片驗證通過！",
          description: result.feedback || config.onSuccess?.message || "任務完成！",
        });
        safeOnComplete(buildReward(true));
      } else if (result.fallback) {
        // 🛡️ AI 服務不可用：讓玩家繼續，但「不計分」（不自動送滿分避免作弊）
        toast({
          title: "照片已上傳",
          description: result.feedback || "AI 暫時無法驗證，可繼續但本題不計分",
        });
        safeOnComplete(buildReward(false));
      } else {
        // AI 確定驗證失敗
        setAiFeedback(result.feedback || config.aiFailMessage || "照片不符合要求");
        setAiDetectedObjects(result.detectedObjects || []);
        camera.setMode("ai_fail");
      }
    },
    onError: () => {
      // API 端點錯誤 → 讓玩家通過但不計分（跟 fallback 行為一致）
      toast({
        title: "照片已上傳",
        description: "AI 服務暫時無法使用，本題不計分",
      });
      safeOnComplete(buildReward(false));
    },
  });

  // 上傳照片
  const uploadMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await apiRequest("POST", "/api/cloudinary/player-photo", {
        imageData,
        gameId,
        sessionId,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "上傳失敗");
      }
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (config.aiVerify && config.targetKeywords && config.targetKeywords.length > 0) {
        // 啟用 AI 驗證 → 呼叫 AI 端點
        camera.setMode("verifying");
        verifyMutation.mutate(data.url);
      } else {
        // 無 AI 驗證 → 直接完成
        toast({
          title: "照片已上傳",
          description: config.onSuccess?.message || "任務完成！",
        });
        safeOnComplete(buildReward(false));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message || "請重試",
        variant: "destructive",
      });
      camera.setMode("preview");
    },
  });

  const submitPhoto = () => {
    if (!camera.capturedImage) {
      toast({
        title: "沒有照片",
        description: "請先拍攝或選擇照片",
        variant: "destructive",
      });
      return;
    }
    camera.setMode("uploading");
    uploadMutation.mutate(camera.capturedImage);
  };

  const handleAiRetry = () => {
    setAiRetryCount((prev) => prev + 1);
    setAiFeedback("");
    setAiDetectedObjects([]);
    camera.retake();
  };

  const handleAiSkip = () => {
    toast({
      title: "已跳過驗證",
      description: "下次拍攝更符合要求的照片吧！",
    });
    safeOnComplete(buildReward(false));
  };

  return (
    <div className="min-h-full flex flex-col p-4">
      {camera.mode === "instruction" && (
        <InstructionView
          config={config}
          cameraError={camera.cameraError}
          onStartCamera={camera.startCamera}
          onClearError={() => camera.cancelCamera()}
          onOpenGallery={() => camera.fileInputRef.current?.click()}
          fileInputRef={camera.fileInputRef}
          onFileUpload={camera.handleFileUpload}
        />
      )}

      {camera.mode === "initializing" && (
        <CameraInitializingView
          videoRef={camera.videoRef}
          onCancel={camera.cancelCamera}
        />
      )}

      {camera.mode === "camera" && (
        <CameraView
          videoRef={camera.videoRef}
          cameraReady={camera.cameraReady}
          fileInputRef={camera.fileInputRef}
          onCapture={camera.capturePhoto}
          onCancel={camera.cancelCamera}
          onRestart={() => {
            // 使用者主動重啟 → 用 retake（會重置 auto-restart counter）
            camera.retake();
          }}
        />
      )}

      {camera.mode === "preview" && camera.capturedImage && (
        <PhotoPreview
          imageSrc={camera.capturedImage}
          onRetake={camera.retake}
          onSubmit={submitPhoto}
        />
      )}

      {camera.mode === "uploading" && <UploadingView />}
      {camera.mode === "verifying" && <VerifyingView />}
      {camera.mode === "ai_fail" && (
        <AiFailView
          feedback={aiFeedback}
          detectedObjects={aiDetectedObjects}
          canRetry={canRetry}
          retryCount={aiRetryCount}
          maxRetries={maxRetries}
          onRetry={handleAiRetry}
          onSkip={handleAiSkip}
        />
      )}
    </div>
  );
}
