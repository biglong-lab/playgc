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
    slotEnd?: string;
    partySize: number;
    status: string;
    paymentStatus: string;
    amountCents: number;
    checkedInAt: string | null;
    paidAt: string | null;
    activityId: string | null;
    customerNote?: string | null;
    adminNote?: string | null;
  };
  activity: { name: string; coverUrl: string | null } | null;
  // 🆕 2026-05-19 後端回傳的時段 / 狀態評估
  timing?: "on_time" | "early" | "late";
  minutesBeforeStart?: number;
  minutesAfterEnd?: number;
  issues?: string[];
}

interface WrongFieldError {
  error: "wrong_field";
  booking?: CheckinResultBooking["booking"];
  otherField?: { code: string; name: string } | null;
  message?: string;
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

  // 🐛 2026-05-19 業主回報 iOS Safari 不支援 BarcodeDetector + video 黑屏
  // 兩層 fallback：BarcodeDetector（Chrome）→ jsQR（iOS Safari / 全瀏覽器）
  // 黑屏修法：先 setCameraStatus 讓 video render、再用 useEffect attach stream
  async function startCamera() {
    setCameraError(null);
    setCameraStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      // 先設 scanning 讓 video element mount → useEffect 會接手 attach
      setCameraStatus("scanning");
    } catch (err) {
      setCameraStatus("error");
      setCameraError(err instanceof Error ? err.message : "無法開啟相機");
    }
  }

  // 🆕 cameraStatus = scanning 後、video mounted → attach stream + 啟動偵測
  useEffect(() => {
    if (cameraStatus !== "scanning") return;
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
    video.muted = true;
    video.play().catch((err) => {
      console.warn("[PosScan] video.play() 失敗:", err);
      setCameraStatus("error");
      setCameraError("無法播放相機畫面、請重試");
    });

    // 啟動偵測
    let cancelled = false;
    (async () => {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (Detector) {
        runNativeDetection(new Detector({ formats: ["qr_code"] }));
        return;
      }
      const jsQRModule = await import("jsqr");
      if (cancelled) return;
      runJsQRDetection(jsQRModule.default);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStatus("idle");
  }

  // 🐛 2026-05-19：QR 掃到的字串先做格式檢查、避免亂送（如鍵盤上的條碼）
  // 接受：BK_xxx / CP_xxx / RD_xxx / 6 字元預約碼
  function isValidToken(token: string): boolean {
    if (!token || token.length < 4 || token.length > 120) return false;
    if (token.startsWith("BK_") && token.length >= 10) return true;
    if (token.startsWith("CP_") && token.length >= 8) return true;
    if (token.startsWith("RD_") && token.length >= 6) return true;
    if (/^[A-Z0-9]{4,12}$/i.test(token)) return true;
    return false;
  }

  // 第二層 fallback：jsQR + canvas（業主 iOS Safari 用這條）
  function runJsQRDetection(jsQR: (data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setCameraStatus("error");
      setCameraError("無法初始化 canvas、請改用手動輸入");
      return;
    }
    const tick = () => {
      if (!videoRef.current || streamRef.current === null) return;
      if (scanLockRef.current) {
        requestAnimationFrame(tick);
        return;
      }
      const video = videoRef.current;
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(tick);
        return;
      }
      // 降採樣減 CPU（300px 寬足以辨識中等距離 QR）
      const targetWidth = 400;
      const ratio = targetWidth / video.videoWidth;
      canvas.width = targetWidth;
      canvas.height = Math.round(video.videoHeight * ratio);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data && isValidToken(code.data.trim())) {
          scanLockRef.current = true;
          submitToken.mutate(code.data.trim());
          return;
        }
        // 掃到但格式不對（如鍵盤條碼、藥罐標籤）→ 繼續掃、不打擾
      } catch {
        // 偶發 frame 取樣失敗、繼續下幀
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function runNativeDetection(detector: { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> }) {
    const tick = async () => {
      if (!videoRef.current || streamRef.current === null) return;
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
            <label className="flex items-center gap-2 pt-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="rounded"
              />
              <span>連續掃描模式（成功不關閉相機、自動繼續掃下一個）</span>
            </label>
          </CardContent>
        </Card>

        {/* 最近掃描歷史 */}
        {recentScans.length > 0 && (
          <Card>
            <CardContent className="py-3 px-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold">最近 3 筆</p>
                <button
                  type="button"
                  onClick={() => setRecentScans([])}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  清除
                </button>
              </div>
              <div className="space-y-1">
                {recentScans.map((s, i) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <span className="text-muted-foreground min-w-[3rem]">{s.time}</span>
                    <span className="font-mono">{s.code}</span>
                    <span className="truncate text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
