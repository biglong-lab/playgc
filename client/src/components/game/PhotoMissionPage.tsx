import { useState } from "react";
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

  // AI 照片驗證
  const verifyMutation = useMutation({
    mutationFn: async (imageUrl: string): Promise<AiVerifyResponse> => {
      const response = await apiRequest("POST", "/api/ai/verify-photo", {
        imageUrl,
        targetKeywords: config.targetKeywords || [],
        instruction: config.instruction,
        confidenceThreshold: config.aiConfidenceThreshold ?? 0.6,
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.verified || result.fallback) {
        // AI 驗證通過（或 fallback 自動通過）
        toast({
          title: result.fallback ? "照片已上傳" : "照片驗證通過！",
          description: result.feedback || config.onSuccess?.message || "任務完成！",
        });
        onComplete(buildReward(true));
      } else {
        // AI 驗證失敗
        setAiFeedback(result.feedback || config.aiFailMessage || "照片不符合要求");
        setAiDetectedObjects(result.detectedObjects || []);
        camera.setMode("ai_fail");
      }
    },
    onError: () => {
      // API 錯誤 → graceful fallback：直接通過
      toast({
        title: "照片已上傳",
        description: "AI 服務暫時無法使用，已自動通過",
      });
      onComplete(buildReward(true));
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
        onComplete(buildReward(false));
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
    onComplete(buildReward(false));
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
