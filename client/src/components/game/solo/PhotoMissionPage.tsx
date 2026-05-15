import { useState, useRef, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PhotoMissionConfig } from "@shared/schema";
import { formatAiError } from "@/lib/ai-error";
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import {
  InstructionView,
  CameraInitializingView,
  CameraView,
  PhotoPreview,
  UploadingView,
  VerifyingView,
  AiFailView,
} from "../photo-mission/PhotoViews";

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
  if (config.mode === "compare") {
    return (
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">載入中...</div>}>
        <PhotoCompareFlow
          config={config}
          onComplete={onComplete}
          sessionId={sessionId}
          gameId={gameId}
        />
      </Suspense>
    );
  }
  // mode === 'team' / 'burst' 等後續輪次加入

  const { toast } = useToast();
  const camera = usePhotoCamera();
  const [aiRetryCount, setAiRetryCount] = useState(0);
  const [aiFeedback, setAiFeedback] = useState("");
  const [aiDetectedObjects, setAiDetectedObjects] = useState<string[]>([]);

  const maxRetries = config.maxAiRetries ?? 3;
  const canRetry = (config.allowRetryOnAiFail !== false) && aiRetryCount < maxRetries;

  const buildReward = (aiVerified: boolean) => {
    // 🔧 修：RewardsSection 存 rewardPoints / rewardItems[]，不是 onSuccess.*
    // 兩套 schema 都讀，向後相容舊資料
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const legacyPoints = config.onSuccess?.points;
    const legacyItem = config.onSuccess?.grantItem;

    const configuredPoints = rewardPoints ?? legacyPoints;
    const basePoints = configuredPoints ?? (config.aiVerify ? 20 : 10);

    const reward: { points?: number; items?: string[] } = {
      points: aiVerified ? basePoints : 0,
    };

    if (aiVerified) {
      const allItems = [
        ...rewardItems.filter((x) => !!x),
        ...(legacyItem ? [legacyItem] : []),
      ];
      if (allItems.length > 0) reward.items = allItems;
    }
    return reward;
  };

  // 防重複 onComplete：AI onError / onSuccess / skip 按鈕連點可能都呼叫 onComplete
  const finishedRef = useRef(false);
  const safeOnComplete = (reward: ReturnType<typeof buildReward>) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete(reward, config.nextPageId);
  };

  // AI 照片驗證
  const verifyMutation = useMutation({
    mutationFn: async (imageUrl: string): Promise<AiVerifyResponse> => {
      // 🐛 修：admin 開 aiVerify 但沒填 keywords 時，後端 schema 要求 min(1)
      // 用 instruction 當 keyword，沒 instruction 用預設「主體清楚的照片」
      const keywords = (config.targetKeywords && config.targetKeywords.length > 0)
        ? config.targetKeywords
        : config.instruction
          ? [config.instruction]
          : ["主體清楚的照片"];

      const response = await apiRequest("POST", "/api/ai/verify-photo", {
        imageUrl,
        targetKeywords: keywords,
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
    onError: (err: unknown) => {
      // API 端點錯誤 → 用共用 helper 給精準訊息，仍讓玩家通過但不計分
      const { title, description } = formatAiError(err);
      toast({ title, description, variant: "destructive" });
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
      // 🐛 修：原本要求 aiVerify=true **且** targetKeywords 有值才驗證
      // 但 admin 常開了 aiVerify 卻忘填 keywords → 跳過驗證直接通過 (玩家覺得 AI 沒運作)
      // 改為：只要 aiVerify=true 就驗證，沒 keywords 用 instruction 或預設「拍照場景」
      if (config.aiVerify) {
        const hasKeywords = config.targetKeywords && config.targetKeywords.length > 0;
        if (!hasKeywords) {
          console.warn(
            "[PhotoMission] aiVerify=true 但未填 targetKeywords，使用 instruction 或預設關鍵字驗證",
          );
        }
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-full flex flex-col p-4"
      role="region"
      aria-label="拍照任務"
    >
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
          onSwitchCamera={camera.switchCamera}
          facingMode={camera.facingMode}
          stream={camera.stream}
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
    </motion.div>
  );
}
