// 🚶 PDR 行人路徑推算 Hook
//
// GPS 失效時的相對定位方案：
//   1. 取得「出發點」座標（GPS 或 admin 預設）
//   2. 用 IMU 加速度計偵測步伐（peak detection）
//   3. 用陀螺儀取得方位
//   4. 累積位移計算當前推算座標
//
// 限制：
//   - 累積誤差（每 100m 約 5-15%）
//   - 需要 iOS 13+ 用戶手動授權 DeviceMotion
//   - 適合「導引方向」非「驗證簽到」
//
// 2026-05-22

import { useEffect, useRef, useState, useCallback } from "react";

interface PDROrigin {
  lat: number;
  lng: number;
  setAt: number; // timestamp
}

interface PDRState {
  /** 當前推算座標 */
  currentLat: number | null;
  currentLng: number | null;
  /** 從上次校正以來的步數 */
  stepsSinceReset: number;
  /** 累積位移（公尺）*/
  totalDistance: number;
  /** 方位（0-360 度）*/
  heading: number | null;
  /** PDR 是否在運作 */
  isActive: boolean;
  /** 預估精度（公尺，隨步數增加而劣化）*/
  estimatedAccuracy: number;
  /** 錯誤訊息 */
  error: string | null;
}

interface PDROptions {
  /** 平均步長（公尺，預設 0.7m）*/
  stepLength?: number;
  /** 加速度偵測閾值（預設 1.2 m/s²）*/
  stepThreshold?: number;
  /** 兩步最小間隔（ms，預設 250）*/
  minStepInterval?: number;
}

const EARTH_RADIUS = 6371000; // 公尺

function moveCoord(lat: number, lng: number, distanceM: number, bearingDeg: number) {
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const angDist = distanceM / EARTH_RADIUS;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

export function usePDRNavigation(options: PDROptions = {}) {
  const {
    stepLength = 0.7,
    stepThreshold = 1.2,
    minStepInterval = 250,
  } = options;

  const [origin, setOrigin] = useState<PDROrigin | null>(null);
  const [state, setState] = useState<PDRState>({
    currentLat: null,
    currentLng: null,
    stepsSinceReset: 0,
    totalDistance: 0,
    heading: null,
    isActive: false,
    estimatedAccuracy: 0,
    error: null,
  });

  const lastStepTimeRef = useRef<number>(0);
  const headingRef = useRef<number>(0);
  // 加速度偵測 — 簡易 peak detection
  const accelHistoryRef = useRef<number[]>([]);

  // 🎯 設定出發點
  const setOriginPoint = useCallback((lat: number, lng: number) => {
    setOrigin({ lat, lng, setAt: Date.now() });
    setState((s) => ({
      ...s,
      currentLat: lat,
      currentLng: lng,
      stepsSinceReset: 0,
      totalDistance: 0,
      estimatedAccuracy: 5,
      error: null,
    }));
  }, []);

  // 🔄 重置（例如通過 QR 點校正）
  const resetToPoint = useCallback((lat: number, lng: number) => {
    setOrigin({ lat, lng, setAt: Date.now() });
    setState((s) => ({
      ...s,
      currentLat: lat,
      currentLng: lng,
      stepsSinceReset: 0,
      totalDistance: 0,
      estimatedAccuracy: 5,
    }));
  }, []);

  // 🛑 停止
  const stop = useCallback(() => {
    setState((s) => ({ ...s, isActive: false }));
  }, []);

  // 🚀 啟動 PDR（需 iOS 13+ 用戶手動觸發以取得權限）
  const start = useCallback(async () => {
    try {
      // iOS 13+ DeviceMotionEvent 需 user gesture 授權
      const motionEventCtor = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof motionEventCtor?.requestPermission === "function") {
        const motionPerm = await motionEventCtor.requestPermission();
        if (motionPerm !== "granted") {
          setState((s) => ({ ...s, error: "DeviceMotion 權限被拒絕" }));
          return false;
        }
      }

      // iOS 13+ DeviceOrientationEvent 也需授權
      const orientEventCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof orientEventCtor?.requestPermission === "function") {
        const orientPerm = await orientEventCtor.requestPermission();
        if (orientPerm !== "granted") {
          setState((s) => ({ ...s, error: "DeviceOrientation 權限被拒絕" }));
          return false;
        }
      }

      setState((s) => ({ ...s, isActive: true, error: null }));
      return true;
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message || "PDR 啟動失敗" }));
      return false;
    }
  }, []);

  // 監聽 DeviceMotion（步伐偵測）
  useEffect(() => {
    if (!state.isActive) return;

    const handleMotion = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel || accel.z === null || accel.z === undefined) return;

      // z 軸加速度（垂直方向，反映步伐）
      // 真實值約 9.8 + 步伐峰值
      const az = accel.z;
      accelHistoryRef.current.push(az);
      if (accelHistoryRef.current.length > 50) accelHistoryRef.current.shift();

      // 簡易 peak detection — 找局部最大值
      const history = accelHistoryRef.current;
      if (history.length >= 5) {
        const mid = history.length - 3;
        const peak = history[mid];
        const left = (history[mid - 1] + history[mid - 2]) / 2;
        const right = (history[mid + 1] + history[mid + 2]) / 2;
        const delta = peak - Math.min(left, right);

        const now = Date.now();
        if (
          delta > stepThreshold &&
          now - lastStepTimeRef.current > minStepInterval &&
          origin
        ) {
          lastStepTimeRef.current = now;
          // 一步前進 stepLength 公尺，沿著當前 heading
          setState((prev) => {
            if (!prev.currentLat || !prev.currentLng) return prev;
            const newPos = moveCoord(
              prev.currentLat,
              prev.currentLng,
              stepLength,
              headingRef.current,
            );
            const newSteps = prev.stepsSinceReset + 1;
            // 精度劣化：每步約增加 5cm 累積誤差（保守估計）
            const newAccuracy = 5 + newSteps * 0.15;
            return {
              ...prev,
              currentLat: newPos.lat,
              currentLng: newPos.lng,
              stepsSinceReset: newSteps,
              totalDistance: prev.totalDistance + stepLength,
              estimatedAccuracy: newAccuracy,
            };
          });
        }
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [state.isActive, origin, stepLength, stepThreshold, minStepInterval]);

  // 監聽 DeviceOrientation（方位）
  useEffect(() => {
    if (!state.isActive) return;

    const handleOrient = (e: DeviceOrientationEvent) => {
      // iOS 用 webkitCompassHeading（0=北，順時針）
      // Android 用 alpha（0=北，逆時針 → 需轉換）
      let heading: number | null = null;
      const eAny = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (typeof eAny.webkitCompassHeading === "number") {
        heading = eAny.webkitCompassHeading;
      } else if (typeof e.alpha === "number") {
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null) {
        headingRef.current = heading;
        setState((s) => ({ ...s, heading }));
      }
    };

    window.addEventListener("deviceorientation", handleOrient as EventListener);
    return () => window.removeEventListener("deviceorientation", handleOrient as EventListener);
  }, [state.isActive]);

  return {
    ...state,
    origin,
    setOriginPoint,
    resetToPoint,
    start,
    stop,
  };
}
