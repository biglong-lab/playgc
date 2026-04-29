// 🧭 IMU PDR 路徑推算 Hook
//
// 目的：GPS 訊號失效時（室內 / 隧道 / 樹蔭），用「步數 + 朝向」推算位置
//
// 原理：
//   新位置 = 起始位置 + Σ (每步距離 × 朝向向量)
//                       ↑              ↑
//                    步幅 0.75m    DeviceOrientation 磁力計
//
// 限制：
//   - 累積誤差：1 分鐘內 < 5m，5 分鐘 > 50m（漂移）
//   - 必須有起始 anchor（從 GPS 來）
//   - 室內磁力計可能受干擾（金屬結構）
//
// 用法：
//   const { position, isActive } = useImuPositioning({
//     anchor: { lat, lng, accuracy },  // 從 GPS 來的起始點
//     enabled: gpsLost,                 // GPS 失效時啟用
//   });

import { useEffect, useRef, useState } from "react";
import { usePedometer } from "./usePedometer";

const EARTH_RADIUS_M = 6371000;

/**
 * 把「步距 + 方位」轉成緯度 / 經度位移
 * 用 equirectangular projection（< 1km 範圍夠準）
 */
function moveLatLng(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number,
): { lat: number; lng: number } {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;

  // 緯度位移（北正南負）
  const dLat = (distanceM * Math.cos(bearingRad)) / EARTH_RADIUS_M;
  // 經度位移（東正西負，要除以 cos(lat) 補償緯度收縮）
  const dLng = (distanceM * Math.sin(bearingRad)) / (EARTH_RADIUS_M * Math.cos(latRad));

  return {
    lat: lat + (dLat * 180) / Math.PI,
    lng: lng + (dLng * 180) / Math.PI,
  };
}

export interface ImuAnchor {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface UseImuPositioningOptions {
  /** GPS 起始點（必填）— PDR 從此點開始推算 */
  anchor: ImuAnchor | null;
  /** 是否啟用（預設 false；通常在 GPS 失效時開啟）*/
  enabled?: boolean;
  /** 步幅（公尺，預設 0.75m）*/
  strideMeters?: number;
  /** 每多少步重整一次（預設 5 步）*/
  recalcEverySteps?: number;
}

export interface ImuPosition {
  lat: number;
  lng: number;
  /** 推算 accuracy（隨步數累積擴大）*/
  accuracy: number;
  /** 從 anchor 走了幾步 */
  stepsSinceAnchor: number;
  /** 從 anchor 起累積距離（公尺）*/
  distanceMeters: number;
  /** 當前朝向（度，0=北）*/
  heading: number | null;
}

export interface UseImuPositioningResult {
  /** PDR 推算位置（null = 還沒開始 / 沒 anchor）*/
  position: ImuPosition | null;
  /** 是否在運作 */
  isActive: boolean;
  /** 是否正在移動 */
  isMoving: boolean;
  /** DeviceMotion 是否可用 */
  available: boolean;
  /** 是否已授權 */
  hasPermission: boolean;
  /** 重置 anchor + 步數 */
  reset: () => void;
}

export function useImuPositioning(
  options: UseImuPositioningOptions,
): UseImuPositioningResult {
  const { anchor, enabled = false, strideMeters = 0.75 } = options;

  const [position, setPosition] = useState<ImuPosition | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

  // 步數偵測
  const { steps, isMoving, available, hasPermission, reset: resetSteps } = usePedometer({
    enabled,
    strideMeters,
  });

  // 朝向監聽（DeviceOrientation API）
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // alpha = 繞 z 軸旋轉（0 = 北，順時針增加）
      // iOS 用 webkitCompassHeading 更準
      const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      if (typeof e.webkitCompassHeading === "number") {
        setHeading(e.webkitCompassHeading);
      } else if (event.alpha != null) {
        // Android: alpha 是「相對北」的補角（360 - alpha）
        setHeading((360 - event.alpha) % 360);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [enabled]);

  // 步數變化時 → 重新推算位置
  const lastCalcStepsRef = useRef(0);
  useEffect(() => {
    if (!enabled || !anchor) {
      setPosition(null);
      return;
    }

    // 每步都重算（不省）
    if (steps === lastCalcStepsRef.current) return;
    lastCalcStepsRef.current = steps;

    if (steps === 0) {
      // 還沒走 → 直接用 anchor
      setPosition({
        lat: anchor.lat,
        lng: anchor.lng,
        accuracy: anchor.accuracy,
        stepsSinceAnchor: 0,
        distanceMeters: 0,
        heading,
      });
      return;
    }

    // 沒有朝向 → 假設往北（無法推算實際位置，至少給 anchor）
    const bearing = heading ?? 0;
    const distance = steps * strideMeters;

    const { lat, lng } = moveLatLng(anchor.lat, anchor.lng, distance, bearing);

    // 累積誤差：每 10 步增加 5m 不確定度
    const driftError = Math.sqrt(steps) * 1.5;
    const accuracy = Math.sqrt(anchor.accuracy ** 2 + driftError ** 2);

    setPosition({
      lat,
      lng,
      accuracy,
      stepsSinceAnchor: steps,
      distanceMeters: distance,
      heading,
    });
  }, [steps, anchor, enabled, strideMeters, heading]);

  const reset = () => {
    resetSteps();
    lastCalcStepsRef.current = 0;
    setPosition(null);
  };

  return {
    position,
    isActive: enabled && available && hasPermission,
    isMoving,
    available,
    hasPermission,
    reset,
  };
}
