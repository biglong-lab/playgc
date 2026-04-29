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

  // 🆕 拒絕後仍允許重試（玩家可能誤觸）
  const isDenied = status === "denied";
  const isChecking = status === "checking";

  return (
    <div
      className={`rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 p-3 transition-all ${className}`}
      data-testid="motion-permission-request"
      data-status={status}
    >
      <div className="flex items-start gap-2 mb-2">
        {/* 🆕 idle 時 compass 緩慢旋轉吸引注意（granted/denied 後停止） */}
        <Compass
          className={`w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 ${
            status === "idle" ? "animate-[spin_4s_linear_infinite]" : ""
          }`}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            開啟動作感應器（提升定位準度）
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            進入室內或 GPS 失效時，用步數 + 方向推算位置
            <span className="block text-[10px] mt-0.5 opacity-80">
              ※ 不會收集隱私資料、不會傳到伺服器
            </span>
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isDenied ? "secondary" : "outline"}
        onClick={handleRequest}
        disabled={isChecking}
        className="w-full transition-transform active:scale-[0.97]"
        data-testid="btn-grant-motion"
      >
        {isChecking ? (
          <>
            <Compass className="w-4 h-4 mr-2 animate-spin" />
            校準中...
          </>
        ) : isDenied ? (
          <>
            <Compass className="w-4 h-4 mr-2 opacity-60" />
            已拒絕 · 點此重試
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            允許動作感應
          </>
        )}
      </Button>
      {/* 🆕 拒絕時補一行說明（原本只有按鈕內文，玩家容易忽略後果） */}
      {/* iOS 一旦拒絕，requestPermission() 不會再彈窗 — 必須去「設定 > Safari > 動作與方向存取」重設 */}
      {isDenied && (
        <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed space-y-0.5">
          <p>⚠️ GPS 失效時將無 IMU 補位 — 室內可能無法判定位置</p>
          <p className="opacity-80">
            如要恢復：請至「設定 → Safari → 動作與方向存取」開啟後重新整理頁面
          </p>
        </div>
      )}
    </div>
  );
}
