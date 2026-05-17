// 📱 POS QR 掃描頁（2026-05-18）
//
// 路徑：/pos/scan
// 偵測：BarcodeDetector（iOS 14.3+/Chrome）→ fallback 手輸
// 流程：掃到 token → POST /api/pos/checkin → 顯示確認頁（報到/收款）

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, CheckCircle2, AlertCircle, Search, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { feedbackScanSuccess, feedbackError } from "@/lib/pos-feedback";

interface CheckinResultBooking {
  type: "booking";
  booking: {
    id: number;
    bookingCode: string;
    displayName: string | null;
    phone?: string | null;
    slotStart: string;
    partySize: number;
    status: string;
    paymentStatus: string;
    amountCents: number;
    checkedInAt: string | null;
    paidAt: string | null;
    activityId: string | null;
    customerNote?: string | null;
  };
  activity: { name: string; coverUrl: string | null } | null;
}

interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): {
    detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
  };
}

export default function PosScan() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<CheckinResultBooking | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "scanning" | "unsupported" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scanLockRef = useRef(false);
  // 🆕 2026-05-18 連續掃描：成功後不停 camera、3 秒後自動清結果繼續掃
  const [continuousMode, setContinuousMode] = useState(false);
  const [recentScans, setRecentScans] = useState<Array<{ code: string; time: string; name: string }>>([]);

  const submitToken = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetchWithAdminAuth("/api/pos/checkin", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      return res as CheckinResultBooking;
    },
    onSuccess: (data) => {
      feedbackScanSuccess();
      setResult(data);
      // 紀錄最近掃描（最多 3 筆）
      const now = new Date();
      setRecentScans((prev) =>
        [
          {
            code: data.booking.bookingCode,
            time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
            name: data.booking.displayName ?? "—",
          },
          ...prev,
        ].slice(0, 3),
      );
      // 連續模式：不停 camera、3 秒後自動清結果
      if (continuousMode) {
        setTimeout(() => {
          setResult(null);
          scanLockRef.current = false;
        }, 3000);
      } else {
        stopCamera();
      }
    },
    onError: (err: unknown) => {
      feedbackError();
      const msg = err instanceof Error ? err.message : "查無此預約";
      toast({ variant: "destructive", title: "找不到", description: msg });
      // 重置鎖，3 秒後恢復掃描
      setTimeout(() => {
        scanLockRef.current = false;
      }, 1500);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return await fetchWithAdminAuth(`/api/pos/bookings/${bookingId}/check-in`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "✅ 已報到" });
      setResult(null);
    },
  });

  // 啟動相機 + BarcodeDetector
  async function startCamera() {
    setCameraError(null);
    setCameraStatus("starting");
    // 偵測 API
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      setCameraStatus("unsupported");
      setCameraError("此瀏覽器不支援 QR 自動辨識、請使用手動輸入");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("scanning");
      runDetection(new Detector({ formats: ["qr_code"] }));
    } catch (err) {
      setCameraStatus("error");
      setCameraError(err instanceof Error ? err.message : "無法開啟相機");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStatus("idle");
  }

  function runDetection(detector: { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> }) {
    const tick = async () => {
      if (!videoRef.current || cameraStatus === "idle") return;
      if (scanLockRef.current) {
        requestAnimationFrame(tick);
        return;
      }
      try {
        const results = await detector.detect(videoRef.current);
        if (results.length > 0 && results[0].rawValue) {
          scanLockRef.current = true;
          submitToken.mutate(results[0].rawValue);
        }
      } catch {
        // 忽略單幀錯誤
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 確認頁
  if (result) {
    const b = result.booking;
    const t = new Date(b.slotStart);
    const dateStr = `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    const alreadyArrived = !!b.checkedInAt;
    const alreadyPaid = b.paymentStatus === "paid" || !!b.paidAt;
    const needsPayment = !alreadyPaid && b.amountCents > 0;
    return (
      <PosLayout title="掃描結果" backTo="/pos/scan">
        <Card className="mb-4">
          {result.activity?.coverUrl && (
            <img src={result.activity.coverUrl} alt={result.activity.name} className="w-full h-32 object-cover rounded-t-lg" />
          )}
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" aria-hidden="true" />
              <h2 className="text-lg font-bold">{b.displayName || "—"}</h2>
            </div>
            {result.activity && (
              <p className="text-sm font-semibold">{result.activity.name}</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Kv label="預約碼" value={b.bookingCode} />
              <Kv label="時間" value={dateStr} />
              <Kv label="人數" value={`${b.partySize} 人`} />
              <Kv label="金額" value={b.amountCents ? `NT$${(b.amountCents / 100).toFixed(0)}` : "—"} />
            </div>
            {b.phone && (
              <a
                href={`tel:${b.phone}`}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                📞 {b.phone}
              </a>
            )}
            {b.customerNote && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-2 py-1.5 rounded text-xs">
                <span className="font-semibold">備註：</span>
                {b.customerNote}
              </div>
            )}

            {alreadyArrived && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 px-3 py-2 rounded text-xs text-green-700 dark:text-green-300">
                ✓ 已於 {new Date(b.checkedInAt!).toLocaleTimeString("zh-TW")} 報到
              </div>
            )}
            {alreadyPaid && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 px-3 py-2 rounded text-xs text-blue-700 dark:text-blue-300">
                ✓ 已收款
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {!alreadyArrived && (
            <Button
              className="w-full h-14 text-base"
              onClick={() => checkInMutation.mutate(b.id)}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-1" />}
              標記到場
            </Button>
          )}
          {needsPayment && (
            <Button
              variant="default"
              className="w-full h-14 text-base bg-amber-600 hover:bg-amber-700"
              onClick={() => navigate(`/pos/checkout?bookingId=${b.id}`)}
            >
              <DollarSign className="w-5 h-5 mr-1" />
              現場收款
            </Button>
          )}
          <Button variant="outline" className="w-full h-14 text-base col-span-2" onClick={() => setResult(null)}>
            繼續掃描
          </Button>
        </div>
      </PosLayout>
    );
  }

  // 掃描頁
  return (
    <PosLayout title="掃描 QR" backTo="/pos">
      <div className="space-y-4">
        {/* 相機區 */}
        {cameraStatus === "scanning" ? (
          <Card className="overflow-hidden">
            <div className="relative bg-black aspect-square">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-12 border-4 border-primary/60 rounded-lg pointer-events-none" />
              {submitToken.isPending && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              )}
            </div>
            <CardContent className="py-2">
              <p className="text-xs text-muted-foreground text-center">將 QR 對準框內、自動辨識</p>
              <Button variant="outline" className="w-full mt-2" onClick={stopCamera}>
                關閉相機
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center space-y-3">
              <Camera className="w-12 h-12 mx-auto text-muted-foreground" aria-hidden="true" />
              <Button onClick={startCamera} className="w-full h-14 text-base" disabled={cameraStatus === "starting"}>
                {cameraStatus === "starting" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-5 h-5 mr-2" />}
                開啟相機掃描
              </Button>
              {cameraError && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-3 py-2 rounded text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 手動輸入 */}
        <Card>
          <CardContent className="py-4 space-y-2">
            <Label htmlFor="manual-token">手動輸入預約碼</Label>
            <div className="flex gap-2">
              <Input
                id="manual-token"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                placeholder="例：C3WJAZ"
                maxLength={20}
              />
              <Button
                onClick={() => manualInput && submitToken.mutate(manualInput.trim())}
                disabled={!manualInput || submitToken.isPending}
              >
                <Search className="w-4 h-4 mr-1" />
                查詢
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">輸入 6 字元預約碼或掃描 QR token</p>
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
