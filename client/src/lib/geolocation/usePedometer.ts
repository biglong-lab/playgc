// 👟 步數偵測 Hook — 用 DeviceMotion API
//
// 原理：
//   走路時加速度計（含重力）合振幅有規律的「峰 - 谷 - 峰」波形
//   每個峰 ≈ 一步，平均步幅 0.7m（成人）
//
// 演算法：簡化版「峰值偵測 + 不應期」
//   1. 計算合振幅 |a| = √(x² + y² + z²)
//   2. 過濾重力（高通濾波，cutoff 0.5Hz）
//   3. 偵測峰值 > 閾值（預設 1.2 m/s²）
//   4. 不應期 250ms（避免單一波被當多步）
//
// iOS 14+ 注意：必須使用者「點按鈕」才能 requestPermission()
//   → 我們提供 requestMotionPermission() 函式，元件 UI 觸發

import { useEffect, useRef, useState } from "react";

// 全域：是否已授權（避免重複問）
let permissionGranted = false;
let permissionRequested = false;

/**
 * 請求 iOS 動作感應權限
 * 必須在使用者手勢（onClick / onTouchStart）內呼叫
 *
 * 回傳：true = 授權、false = 拒絕、"unsupported" = 不需授權（Android）
 */
export async function requestMotionPermission(): Promise<boolean | "unsupported"> {
  // iOS 13+ 才有 requestPermission
  type DM = typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  const DMEvent = DeviceMotionEvent as unknown as DM;

  if (typeof DMEvent.requestPermission !== "function") {
    permissionGranted = true; // Android / 老 iOS 不需授權
    return "unsupported";
  }

  if (permissionRequested) return permissionGranted;

  try {
    permissionRequested = true;
    const result = await DMEvent.requestPermission();
    permissionGranted = result === "granted";
    return permissionGranted;
  } catch {
    permissionGranted = false;
    return false;
  }
}

/** 是否已知有授權（不會主動請求）*/
export function hasMotionPermission(): boolean {
  return permissionGranted;
}

export interface UsePedometerOptions {
  /** 是否啟用（預設 true）*/
  enabled?: boolean;
  /** 峰值閾值（預設 1.2 m/s²，靜止時 < 0.5）*/
  threshold?: number;
  /** 不應期（毫秒，預設 250ms）*/
  refractoryMs?: number;
  /** 平均步幅（公尺，預設 0.75m，成人男性平均）*/
  strideMeters?: number;
  /** 每步 callback（給 PDR hook 用來推位置）*/
  onStep?: (timestamp: number) => void;
}

export interface UsePedometerResult {
  /** 累積步數 */
  steps: number;
  /** 估算移動距離（公尺）*/
  distanceMeters: number;
  /** 是否在動（最近 2 秒有偵測到步伐）*/
  isMoving: boolean;
  /** DeviceMotion 是否可用 */
  available: boolean;
  /** 是否已授權（iOS 才需要）*/
  hasPermission: boolean;
  /** 重置計數 */
  reset: () => void;
}

export function usePedometer(options: UsePedometerOptions = {}): UsePedometerResult {
  const {
    enabled = true,
    threshold = 1.2,
    refractoryMs = 250,
    strideMeters = 0.75,
    onStep,
  } = options;

  const [steps, setSteps] = useState(0);
  const [available] = useState<boolean>(typeof window !== "undefined" && "DeviceMotionEvent" in window);
  const [hasPermission, setHasPermission] = useState<boolean>(permissionGranted);
  const [isMoving, setIsMoving] = useState(false);

  // 簡單高通濾波（過濾重力）狀態
  const lastAccelRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const filteredRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastStepAtRef = useRef<number>(0);
  const lastMotionAtRef = useRef<number>(0);
  const isMovingRef = useRef(false);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  useEffect(() => {
    if (!enabled || !available) return;

    // iOS 沒授權就不啟動（呼叫者要先 requestMotionPermission）
    if (!permissionGranted) {
      // 嘗試一次（Android 自動 granted）
      void requestMotionPermission().then((r) => {
        setHasPermission(r === true || r === "unsupported");
      });
      return;
    }
    setHasPermission(true);

    const HIGH_PASS_ALPHA = 0.8; // 高通濾波係數（接近 1 = 強過濾）

    const handleMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      // 高通濾波（去除重力分量）
      // filtered = α × filtered + (1 - α) × (raw - lastRaw)
      if (lastAccelRef.current) {
        filteredRef.current.x =
          HIGH_PASS_ALPHA * (filteredRef.current.x + a.x - lastAccelRef.current.x);
        filteredRef.current.y =
          HIGH_PASS_ALPHA * (filteredRef.current.y + a.y - lastAccelRef.current.y);
        filteredRef.current.z =
          HIGH_PASS_ALPHA * (filteredRef.current.z + a.z - lastAccelRef.current.z);
      }
      lastAccelRef.current = { x: a.x, y: a.y, z: a.z };

      // 合振幅
      const magnitude = Math.sqrt(
        filteredRef.current.x ** 2 +
          filteredRef.current.y ** 2 +
          filteredRef.current.z ** 2,
      );

      const now = Date.now();

      // 峰值偵測 + 不應期
      if (magnitude > threshold && now - lastStepAtRef.current > refractoryMs) {
        lastStepAtRef.current = now;
        lastMotionAtRef.current = now;
        setSteps((s) => s + 1);
        onStepRef.current?.(now);

        if (!isMovingRef.current) {
          isMovingRef.current = true;
          setIsMoving(true);
        }
      }

      // 是否還在動（2 秒沒踏步 → 停止）
      if (isMovingRef.current && now - lastMotionAtRef.current > 2000) {
        isMovingRef.current = false;
        setIsMoving(false);
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [enabled, available, threshold, refractoryMs]);

  const reset = () => {
    setSteps(0);
    lastStepAtRef.current = 0;
    lastMotionAtRef.current = 0;
    isMovingRef.current = false;
    setIsMoving(false);
  };

  return {
    steps,
    distanceMeters: steps * strideMeters,
    isMoving,
    available,
    hasPermission,
    reset,
  };
}
