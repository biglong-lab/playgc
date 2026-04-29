// 🧭 IMU 動作感應器授權請求元件
//
// 為什麼需要：
//   iOS 14+ Safari 要求「DeviceMotionEvent.requestPermission()」
//   必須在「使用者手勢」內呼叫（onClick / onTouchStart）
//   不能在 onload 自動觸發
//
// 用法（GpsMissionPage 開始按鈕旁）：
//   <MotionPermissionRequest
//     onGranted={() => console.log("可用 IMU fallback")}
//     onDenied={() => console.log("沒有 IMU，純 GPS")}
//   />

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Compass, CheckCircle2 } from "lucide-react";
import { requestMotionPermission, hasMotionPermission } from "@/lib/geolocation";

interface MotionPermissionRequestProps {
  onGranted?: () => void;
  onDenied?: () => void;
  /** 隱藏 UI，只用於程式呼叫 */
  silent?: boolean;
  className?: string;
}

export function MotionPermissionRequest({
  onGranted,
  onDenied,
  silent = false,
  className = "",
}: MotionPermissionRequestProps) {
  const [status, setStatus] = useState<"idle" | "checking" | "granted" | "denied">(
    hasMotionPermission() ? "granted" : "idle"
  );
  const [needsRequest, setNeedsRequest] = useState(false);

  // 偵測是否需要請求（iOS 14+）
  useEffect(() => {
    if (typeof window === "undefined") return;
    type DM = typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DMEvent = DeviceMotionEvent as unknown as DM;
    setNeedsRequest(typeof DMEvent.requestPermission === "function");
  }, []);

  const handleRequest = async () => {
    setStatus("checking");
    const result = await requestMotionPermission();
    if (result === true || result === "unsupported") {
      setStatus("granted");
      onGranted?.();
    } else {
      setStatus("denied");
      onDenied?.();
    }
  };

  // Silent mode 或不需請求 / 已授權 → 不顯示
  if (silent) return null;
  if (!needsRequest) return null;
  if (status === "granted") return null;

  return (
    <div
      className={`rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 p-3 ${className}`}
      data-testid="motion-permission-request"
    >
      <div className="flex items-start gap-2 mb-2">
        <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            開啟動作感應器（提升定位準度）
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            進入室內或 GPS 失效時，用步數 + 方向推算位置（不會收集隱私資料）
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRequest}
        disabled={status === "checking"}
        className="w-full"
        data-testid="btn-grant-motion"
      >
        {status === "checking" ? (
          <>校準中...</>
        ) : status === "denied" ? (
          <>已拒絕（GPS 失效時將無 IMU 補位）</>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            允許動作感應
          </>
        )}
      </Button>
    </div>
  );
}
