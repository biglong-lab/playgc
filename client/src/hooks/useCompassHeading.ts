// 🧭 useCompassHeading — 取得設備朝向（指南針方位）
// Phase #4 fix (2026-05-12)
//
// 用法：
//   const { heading, supported, request } = useCompassHeading();
//   // heading: 0-360（0=北、90=東、180=南、270=西）
//   // iOS 需 user gesture 觸發 request()
//
// 跨平台：
//   - iOS 13+：需 DeviceOrientationEvent.requestPermission()（user gesture 後呼叫）
//   - Android：webkitCompassHeading 不存在、用 alpha（需 absolute=true 校正）
//   - Desktop：通常不支援、heading 為 null

import { useEffect, useRef, useState, useCallback } from "react";

interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventConstructor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

export interface CompassHeadingApi {
  /** 設備朝向（0-360）、null = 未取得或不支援 */
  heading: number | null;
  /** 平台是否支援 */
  supported: boolean;
  /** iOS 請求權限（user gesture 後呼叫）*/
  request: () => Promise<boolean>;
  /** 已授權 */
  granted: boolean;
}

export function useCompassHeading(): CompassHeadingApi {
  const [heading, setHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof window.DeviceOrientationEvent !== "undefined";

  const handler = useCallback((e: DeviceOrientationEvent) => {
    const ios = e as DeviceOrientationEventiOS;
    // iOS：webkitCompassHeading（順時針 0-360）
    if (typeof ios.webkitCompassHeading === "number") {
      setHeading(ios.webkitCompassHeading);
      return;
    }
    // Android：alpha（逆時針、需翻轉為順時針）
    // alpha 0 = 北、但是逆時針增加；轉成順時針：(360 - alpha) % 360
    if (typeof e.alpha === "number") {
      const compass = (360 - e.alpha) % 360;
      setHeading(compass);
    }
  }, []);

  // 自動 attach listener（已授權 / 不需要授權的平台）
  useEffect(() => {
    if (!supported) return;
    const Constructor = (
      window.DeviceOrientationEvent as unknown as DeviceOrientationEventConstructor
    );
    if (typeof Constructor.requestPermission === "function") {
      // iOS：等 request() 觸發
      return;
    }
    // Android / 其他：直接 attach
    listenerRef.current = handler;
    window.addEventListener("deviceorientation", handler, { passive: true });
    setGranted(true);
    return () => {
      if (listenerRef.current) {
        window.removeEventListener("deviceorientation", listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [supported, handler]);

  const request = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    const Constructor = (
      window.DeviceOrientationEvent as unknown as DeviceOrientationEventConstructor
    );
    if (typeof Constructor.requestPermission !== "function") {
      // 平台不需要 permission、直接視為 granted
      setGranted(true);
      return true;
    }
    try {
      const result = await Constructor.requestPermission();
      if (result === "granted") {
        listenerRef.current = handler;
        window.addEventListener("deviceorientation", handler, { passive: true });
        setGranted(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [supported, handler]);

  return { heading, supported, granted, request };
}
