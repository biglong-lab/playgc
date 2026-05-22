// 🎯 玩家端 — 多元定位驗證主元件
// 整合 GPS / QR / 代碼三種驗證方式，依 location.verificationMode 顯示可用按鈕
// 2026-05-22

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Satellite, QrCode, KeyRound, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { LocationQRScanner, type ScannedLocationPayload } from "./LocationQRScanner";

type VerificationMode = "gps" | "qr" | "code" | "hybrid" | "any";
type VerifyMethod = "gps" | "qr" | "code";

interface Props {
  sessionId: string;
  locationId: number;
  locationName: string;
  verificationMode: VerificationMode;
  /** 當前 GPS 座標（若可用） */
  currentPosition?: { lat: number; lng: number; accuracy?: number } | null;
  onSuccess?: () => void;
}

function getAvailableMethods(mode: VerificationMode): VerifyMethod[] {
  switch (mode) {
    case "gps":
      return ["gps"];
    case "qr":
      return ["qr"];
    case "code":
      return ["code"];
    case "hybrid":
    case "any":
      return ["gps", "qr", "code"];
    default:
      return ["gps"];
  }
}

const METHOD_META: Record<VerifyMethod, { label: string; icon: typeof Satellite; hint: string }> = {
  gps: { label: "用 GPS 簽到", icon: Satellite, hint: "需要在任務點半徑內" },
  qr: { label: "掃描 QR Code", icon: QrCode, hint: "對準現場 QR 即可" },
  code: { label: "輸入代碼", icon: KeyRound, hint: "輸入現場 4-6 位代碼" },
};

export function LocationVerifier({
  sessionId,
  locationId,
  locationName,
  verificationMode,
  currentPosition,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [activeMethod, setActiveMethod] = useState<VerifyMethod | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [code, setCode] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const methods = getAvailableMethods(verificationMode);

  const visitMutation = useMutation({
    mutationFn: async (data: { verifyMethod: VerifyMethod; verifyPayload: unknown }) => {
      const res = await apiRequest(
        "POST",
        `/api/sessions/${sessionId}/locations/${locationId}/visit`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      setLastError(null);
      toast({
        title: "✅ 已完成簽到",
        description: locationName,
      });
      onSuccess?.();
    },
    onError: async (err: unknown) => {
      const msg = (err as { message?: string })?.message || "簽到失敗，請稍候再試";
      setLastError(msg);
      toast({ title: "簽到失敗", description: msg, variant: "destructive" });
    },
  });

  const handleGpsVerify = () => {
    if (!currentPosition) {
      toast({
        title: "GPS 尚未取得位置",
        description: "請等候定位完成，或改用其他方式",
        variant: "destructive",
      });
      return;
    }
    visitMutation.mutate({
      verifyMethod: "gps",
      verifyPayload: {
        lat: currentPosition.lat,
        lng: currentPosition.lng,
        accuracy: currentPosition.accuracy,
      },
    });
  };

  const handleQrDetect = (payload: ScannedLocationPayload) => {
    setShowScanner(false);
    if (payload.locationId !== locationId) {
      setLastError("這不是本任務點的 QR Code");
      toast({
        title: "QR Code 不對應",
        description: `掃到的是另一個任務點（#${payload.locationId}）`,
        variant: "destructive",
      });
      return;
    }
    visitMutation.mutate({
      verifyMethod: "qr",
      verifyPayload: { qrToken: payload.qrToken },
    });
  };

  const handleCodeSubmit = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({ title: "請輸入代碼", variant: "destructive" });
      return;
    }
    visitMutation.mutate({
      verifyMethod: "code",
      verifyPayload: { code: trimmed },
    });
  };

  if (showScanner) {
    return (
      <LocationQRScanner
        onDetect={handleQrDetect}
        onClose={() => setShowScanner(false)}
        onSwitchToCode={
          methods.includes("code")
            ? () => {
                setShowScanner(false);
                setActiveMethod("code");
              }
            : undefined
        }
      />
    );
  }

  return (
    <Card data-testid={`location-verifier-${locationId}`}>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-sm mb-1">確認到達「{locationName}」</h3>
          <p className="text-xs text-muted-foreground">
            {methods.length > 1 ? "可選任一方式：" : "請使用以下方式："}
          </p>
        </div>

        {/* 方法選擇按鈕 */}
        <div className="grid gap-2">
          {methods.map((m) => {
            const meta = METHOD_META[m];
            const Icon = meta.icon;
            const isActive = activeMethod === m;
            return (
              <Button
                key={m}
                variant={isActive ? "default" : "outline"}
                className="justify-start h-auto py-3"
                onClick={() => {
                  setLastError(null);
                  if (m === "qr") {
                    setActiveMethod("qr");
                    setShowScanner(true);
                  } else if (m === "gps") {
                    setActiveMethod("gps");
                    handleGpsVerify();
                  } else {
                    setActiveMethod("code");
                  }
                }}
                disabled={visitMutation.isPending}
                data-testid={`button-verify-${m}-${locationId}`}
              >
                <Icon className="w-4 h-4 mr-3 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{meta.label}</div>
                  <div className="text-xs opacity-70">{meta.hint}</div>
                </div>
                {visitMutation.isPending && isActive && (
                  <Loader2 className="w-4 h-4 ml-auto animate-spin" />
                )}
              </Button>
            );
          })}
        </div>

        {/* 代碼輸入區 */}
        {activeMethod === "code" && (
          <div className="space-y-2 p-3 rounded-md bg-muted/40">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例如：A23B"
              maxLength={10}
              autoFocus
              className="font-mono uppercase text-center text-lg tracking-widest"
              data-testid={`input-verify-code-${locationId}`}
            />
            <Button
              className="w-full"
              onClick={handleCodeSubmit}
              disabled={visitMutation.isPending || !code.trim()}
              data-testid={`button-submit-code-${locationId}`}
            >
              {visitMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              確認簽到
            </Button>
          </div>
        )}

        {/* 錯誤訊息 */}
        {lastError && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}

        {/* GPS 狀態提示 */}
        {methods.includes("gps") && !currentPosition && (
          <p className="text-xs text-amber-600">
            ⚠ 尚未取得 GPS 位置（可能被關閉或訊號弱），建議使用 QR 或代碼
          </p>
        )}
      </CardContent>
    </Card>
  );
}
