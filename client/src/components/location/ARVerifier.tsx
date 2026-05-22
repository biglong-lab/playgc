// 📸 玩家端 — AR 影像辨識驗證元件
//
// 流程：
//   1. 玩家用相機拍照（input capture="environment"）
//   2. 上傳到 Cloudinary（複用現有 media upload）
//   3. 傳 URL 給 server → 後端算 dHash + 比對 referenceImageHash
//   4. matchScore ≥ 0.7 → 帶入 visit 端點完成簽到
//
// 限制：
//   - 任務點必須事先由 admin 設定 referenceImageHash
//   - 玩家照片角度差太多會被拒
//
// 2026-05-22

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, CheckCircle2, XCircle, Loader2, Image as ImageIcon } from "lucide-react";

interface Props {
  sessionId: string;
  locationId: number;
  locationName: string;
  onSuccess?: () => void;
}

export function ARVerifier({ sessionId, locationId, locationName, onSuccess }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);

  // 上傳照片到 media endpoint（複用現有上傳機制）
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      // 用 fetch 直接上傳（apiRequest 不支援 FormData）
      const res = await fetch("/api/media/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      setUploadedUrl(data.url);
      verifyMutation.mutate(data.url);
    },
    onError: () => toast({ title: "照片上傳失敗", variant: "destructive" }),
  });

  // 呼叫後端比對
  const verifyMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/locations/${locationId}/verify-photo`,
        { imageUrl },
      );
      return res.json() as Promise<{
        matchScore: number;
        hammingDistance: number;
        referenceImageId: string;
        passed: boolean;
      }>;
    },
    onSuccess: (data) => {
      setMatchScore(data.matchScore);
      if (!data.passed) {
        toast({
          title: "拍到的場景不一致",
          description: `比對分數 ${data.matchScore.toFixed(2)}（需 ≥ 0.70）`,
          variant: "destructive",
        });
        return;
      }
      // 通過比對 → 走 visit endpoint
      visitMutation.mutate(data);
    },
  });

  // 最終簽到（verify_method = 'ar'）
  const visitMutation = useMutation({
    mutationFn: async (data: { matchScore: number; referenceImageId: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/locations/${locationId}/visit`,
        {
          verifyMethod: "ar",
          verifyPayload: {
            matchScore: data.matchScore,
            referenceImageId: data.referenceImageId,
          },
        },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ AR 簽到成功", description: locationName });
      onSuccess?.();
    },
  });

  const handleFile = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setMatchScore(null);
    uploadMutation.mutate(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const isLoading =
    uploadMutation.isPending || verifyMutation.isPending || visitMutation.isPending;

  return (
    <Card data-testid={`ar-verifier-${locationId}`}>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-sm mb-1">用拍照確認到達「{locationName}」</h3>
          <p className="text-xs text-muted-foreground">拍下任務點的標誌物或場景</p>
        </div>

        {/* 預覽 */}
        {previewUrl && (
          <div className="rounded-md overflow-hidden border bg-muted/40 aspect-video flex items-center justify-center">
            <img src={previewUrl} alt="預覽" className="max-h-full max-w-full object-contain" />
          </div>
        )}

        {/* 上傳按鈕 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          data-testid={`input-ar-photo-${locationId}`}
        />
        <Button
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          data-testid={`button-take-photo-${locationId}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : previewUrl ? (
            <ImageIcon className="w-4 h-4 mr-2" />
          ) : (
            <Camera className="w-4 h-4 mr-2" />
          )}
          {previewUrl ? "重新拍照" : "拍照"}
        </Button>

        {/* 進度提示 */}
        {uploadMutation.isPending && (
          <p className="text-xs text-center text-muted-foreground">上傳照片中…</p>
        )}
        {verifyMutation.isPending && (
          <p className="text-xs text-center text-muted-foreground">比對場景中…</p>
        )}
        {visitMutation.isPending && (
          <p className="text-xs text-center text-muted-foreground">記錄簽到中…</p>
        )}

        {/* 比對結果 */}
        {matchScore !== null && (
          <Alert variant={matchScore >= 0.7 ? "default" : "destructive"}>
            {matchScore >= 0.7 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <AlertDescription>
              比對分數：{matchScore.toFixed(2)} / 1.00
              {matchScore < 0.7 && "（場景不符，請靠近一點或重拍）"}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
