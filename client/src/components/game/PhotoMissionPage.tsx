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
} from "./photo-mission/PhotoViews";

interface PhotoMissionPageProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function PhotoMissionPage({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoMissionPageProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();

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
    onSuccess: () => {
      const reward: { points?: number; items?: string[] } = {
        points: config.aiVerify ? 20 : 10,
      };
      if (config.onSuccess?.grantItem) {
        reward.items = [config.onSuccess.grantItem];
      }

      if (config.aiVerify) {
        camera.setMode("verifying");
        setTimeout(() => {
          toast({
            title: "照片驗證通過!",
            description: config.onSuccess?.message || "任務完成!",
          });
          onComplete(reward);
        }, 2000);
      } else {
        toast({
          title: "照片已上傳",
          description: config.onSuccess?.message || "任務完成!",
        });
        onComplete(reward);
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
    </div>
  );
}
