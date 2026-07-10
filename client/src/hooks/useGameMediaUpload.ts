// 🎵 D2-c+ (2026-05-09)：通用 game-scope 媒體上傳 hook
//
// 用途：admin 在 game 範圍內上傳 image / video / audio（含 BGM）到 Cloudinary
// 端點：POST /api/admin/games/:gameId/cloudinary-media
//
// 使用：
//   const { handleUpload, isUploading } = useGameMediaUpload(gameId);
//   <input type="file" onChange={async (e) => {
//     const url = await handleUpload(e.target.files[0], "audio");
//     if (url) setBgmUrl(url);
//   }} />
//
// 限制：
//   - 必須先有 gameId（新建遊戲尚未儲存時無法上傳、會 toast 提示）
//   - image ≤ 10MB / video ≤ 50MB / audio ≤ 30MB
//   - MIME prefix 必須對應（image/* / video/* / audio/*）
//
// 抽自 client/src/pages/game-editor/index.tsx:61-139 — 跨頁面共用

import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { compressImageToDataUrl } from "@/lib/image-compress";

export type MediaType = "video" | "audio" | "image";

const MAX_SIZES_MB: Record<MediaType, number> = {
  image: 10,
  video: 50,
  audio: 30,
};

const MIME_PREFIXES: Record<MediaType, string> = {
  image: "image/",
  video: "video/",
  audio: "audio/",
};

export function useGameMediaUpload(gameId: string | undefined | null) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(
    async (file: File, type: MediaType): Promise<string | null> => {
      if (!gameId) {
        toast({
          title: "請先儲存遊戲",
          description: "建立遊戲後重新進入編輯即可上傳媒體",
          variant: "destructive",
        });
        return null;
      }

      // 前端預檢：MIME + size
      if (!file.type.startsWith(MIME_PREFIXES[type])) {
        toast({
          title: "檔案類型錯誤",
          description: `請選擇 ${type} 檔案（偵測到 ${file.type || "unknown"}）`,
          variant: "destructive",
        });
        return null;
      }
      const maxBytes = MAX_SIZES_MB[type] * 1024 * 1024;
      if (file.size > maxBytes) {
        toast({
          title: "檔案過大",
          description: `${type} 檔案不能超過 ${MAX_SIZES_MB[type]}MB（您的檔案 ${(file.size / 1024 / 1024).toFixed(1)}MB）`,
          variant: "destructive",
        });
        return null;
      }

      setIsUploading(true);
      try {
        // 只有 image 分支做本地壓縮（影音不可壓）
        const base64 =
          type === "image"
            ? await compressImageToDataUrl(file, "cover")
            : await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });

        const response = await apiRequest(
          "POST",
          `/api/admin/games/${gameId}/cloudinary-media`,
          {
            mediaData: base64,
            mediaType: type,
            gameId,
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || errorData.error || `上傳失敗 (HTTP ${response.status})`,
          );
        }

        const result = await response.json();
        const labels: Record<MediaType, string> = { video: "影片", audio: "音訊", image: "圖片" };
        toast({ title: "上傳成功", description: `${labels[type]}已上傳` });
        return result.url as string;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "未知錯誤";
        console.error("[useGameMediaUpload] 上傳失敗:", error);
        toast({ title: "上傳失敗", description: message, variant: "destructive" });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [gameId, toast],
  );

  return { handleUpload, isUploading };
}
