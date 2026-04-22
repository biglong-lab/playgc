// 🧪 AI 照片驗證測試器
//
// 用途：管理員在編輯 PhotoMission 時，直接用當前設定試拍一張照片看 AI 回傳什麼
// 不會影響 session / 正式遊戲資料，純粹驗證設定合不合理
//
// 流程：選檔 → 上傳 Cloudinary → 呼叫 /api/ai/verify-photo → 顯示 verified / confidence / feedback / detectedObjects
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  FlaskConical, Upload, CheckCircle2, XCircle, Loader2,
  AlertTriangle,
} from "lucide-react";

interface AIPhotoTesterProps {
  gameId: string;
  targetKeywords: string[];
  instruction?: string;
  confidenceThreshold?: number;
  aiModelId?: string;
  disabled?: boolean;
}

interface AiVerifyResult {
  verified: boolean;
  confidence: number;
  feedback: string;
  detectedObjects?: string[];
  fallback?: boolean;
}

export function AIPhotoTester({
  gameId,
  targetKeywords,
  instruction,
  confidenceThreshold,
  aiModelId,
  disabled,
}: AIPhotoTesterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AiVerifyResult | null>(null);
  const [testedImageUrl, setTestedImageUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canTest =
    !!gameId &&
    Array.isArray(targetKeywords) &&
    targetKeywords.length > 0 &&
    !disabled;

  const handleFile = async (file: File) => {
    setTesting(true);
    setResult(null);
    setErrorMsg(null);

    try {
      // 1. 轉 base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. 上傳到 Cloudinary（重用玩家端的端點，不佔 session）
      const uploadRes = await apiRequest("POST", "/api/cloudinary/upload", {
        imageData: base64,
        gameId,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || "上傳失敗");
      }
      const uploadData = await uploadRes.json();
      setTestedImageUrl(uploadData.url);

      // 3. 呼叫 AI 驗證
      const verifyRes = await apiRequest("POST", "/api/ai/verify-photo", {
        imageUrl: uploadData.url,
        targetKeywords,
        instruction,
        confidenceThreshold,
        gameId,
        // 若 AI model schema 支援就帶；後端忽略未認得的欄位
        modelId: aiModelId,
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.message || err.error || "AI 驗證失敗");
      }
      const data: AiVerifyResult = await verifyRes.json();
      setResult(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border border-dashed rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium">AI 驗證測試</span>
        <span className="text-xs text-muted-foreground">
          拍一張測試照片，立即看當前設定的 AI 回傳結果
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // 允許同一張連續選
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={!canTest || testing}
        className="gap-2"
      >
        {testing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            測試中...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            選擇測試照片
          </>
        )}
      </Button>

      {!canTest && !testing && (
        <p className="text-xs text-muted-foreground">
          {!gameId && "需先儲存遊戲才能測試；"}
          {(!targetKeywords || targetKeywords.length === 0) &&
            "請先填入至少一個關鍵字"}
        </p>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">測試失敗</div>
            <div className="opacity-80">{errorMsg}</div>
          </div>
        </div>
      )}

      {result && !errorMsg && (
        <div className="flex gap-3 items-start pt-1">
          {testedImageUrl && (
            <img
              src={testedImageUrl}
              alt="test"
              className="w-20 h-20 rounded object-cover border shrink-0"
            />
          )}
          <div className="flex-1 text-xs space-y-1">
            <div className="flex items-center gap-2">
              {result.verified ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`font-medium ${
                  result.verified ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {result.verified ? "通過" : "未通過"}
              </span>
              {typeof result.confidence === "number" && (
                <span className="text-muted-foreground">
                  · 信心 {Math.round(result.confidence * 100)}%
                </span>
              )}
              {result.fallback && (
                <span className="text-amber-600 text-[10px]">
                  ⚠️ AI 服務暫用 fallback
                </span>
              )}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium">回饋：</span>
              {result.feedback}
            </div>
            {result.detectedObjects && result.detectedObjects.length > 0 && (
              <div className="text-muted-foreground">
                <span className="font-medium">偵測到：</span>
                {result.detectedObjects.join("、")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
