// 📷 玩家端 — 任務點 QR 掃描器
// 掃描 admin 列印的任務點 QR，解析後回傳 { locationId, qrToken }
// 2026-05-22

import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Html5QrcodeInstance = any;

export interface ScannedLocationPayload {
  locationId: number;
  qrToken: string;
}

interface Props {
  onDetect: (payload: ScannedLocationPayload) => void;
  onClose: () => void;
  onSwitchToCode?: () => void;
}

function parseScanError(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  const message = (err as { message?: string })?.message || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "相機權限被拒絕\n請在瀏覽器設定允許相機";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "此裝置找不到相機";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "相機被其他 App 佔用，請先關閉";
  }
  if (name === "SecurityError") return "需要 HTTPS 才能用相機";
  return message || "相機啟動失敗";
}

function parseLocationQr(text: string): ScannedLocationPayload | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.t === "loc" && typeof parsed.id === "number" && typeof parsed.tok === "string") {
      return { locationId: parsed.id, qrToken: parsed.tok };
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

export function LocationQRScanner({ onDetect, onClose, onSwitchToCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    let instance: Html5QrcodeInstance = null;

    const tryStart = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;
        const divId = "location-qr-reader";
        containerRef.current.id = divId;
        instance = new Html5Qrcode(divId);
        scannerRef.current = instance;

        const configs = [{ facingMode: "environment" }, { facingMode: "user" }, true];
        let lastErr: unknown = null;
        for (const c of configs) {
          try {
            await instance.start(
              c as never,
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText: string) => {
                if (!mounted) return;
                const payload = parseLocationQr(decodedText);
                if (payload) {
                  onDetect(payload);
                }
              },
              () => {},
            );
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (lastErr) throw lastErr;
      } catch (err) {
        if (mounted) setError(parseScanError(err));
      }
    };

    tryStart();

    return () => {
      mounted = false;
      if (instance && instance.isScanning) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      }
    };
  }, [onDetect, retryKey]);

  return (
    <div className="fixed inset-0 z-[1200] bg-black flex flex-col" data-testid="location-qr-scanner">
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b">
        <span className="font-medium">📷 掃描任務點 QR</span>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-accent"
          data-testid="location-qr-close"
          aria-label="關閉"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative bg-black">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white px-6">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <div className="text-center">
              <div className="font-semibold text-lg">相機無法啟動</div>
              <div className="text-sm text-white/80 mt-2 whitespace-pre-line">{error}</div>
            </div>
            <div className="w-full max-w-xs space-y-2">
              <Button
                className="w-full"
                onClick={() => {
                  setError(null);
                  setRetryKey((k) => k + 1);
                }}
              >
                重試
              </Button>
              {onSwitchToCode && (
                <Button variant="outline" className="w-full" onClick={onSwitchToCode}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  改用代碼輸入
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>

      <div className="px-4 py-3 bg-background border-t text-center text-xs text-muted-foreground">
        把鏡頭對準任務點 QR Code
      </div>
    </div>
  );
}
