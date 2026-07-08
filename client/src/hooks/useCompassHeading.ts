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
//     webkitCompassHeading 本身就是「真北順時針方位」，直接用
//   - Android：⚠️ 2026-07-08 CHITO #c92e32dc 第 9 修根因 —
//     原本監聽 `deviceorientation`，其 alpha 在 Android 上是「相對頁面載入時
//     朝向」的任意基準（absolute=false），根本不是指北 → 指向標整組漂移/反向、
//     且每次進頁行為不同（前 8 輪改公式都修不好的原因：來源就不是方位角）。
//     改監聽 `deviceorientationabsolute`（Chrome/Android 專屬、alpha 保證絕對
//     方位），並加螢幕方向（screen.orientation.angle）補償。
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
  /** 🆕 heading 來源是否為絕對方位（false = Android 舊機 fallback、可能漂移） */
  isAbsolute: boolean;
}

/** 取得螢幕旋轉角（0/90/180/270）— 橫持手機時 alpha 基準會偏轉、需補償 */
function getScreenOrientationAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle =
    window.screen?.orientation?.angle ??
    (typeof window.orientation === "number" ? window.orientation : 0);
  return ((Number(angle) || 0) + 360) % 360;
}

/**
 * Android alpha → 順時針指北方位
 * absolute alpha：0 = 手機頂朝北、逆時針增加 → 順時針方位 = (360 - alpha)
 * 再加螢幕旋轉補償（直向 portrait angle=0 時不影響）
 */
export function alphaToCompassHeading(alpha: number, screenAngle: number): number {
  return (360 - alpha + screenAngle) % 360;
}

export function useCompassHeading(): CompassHeadingApi {
  const [heading, setHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const [isAbsolute, setIsAbsolute] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof window.DeviceOrientationEvent !== "undefined";

  const handleIos = useCallback((e: DeviceOrientationEvent) => {
    const ios = e as DeviceOrientationEventiOS;
    // iOS：webkitCompassHeading（真北、順時針 0-360）— 本身已是方位角
    if (typeof ios.webkitCompassHeading === "number") {
      setHeading(ios.webkitCompassHeading);
      setIsAbsolute(true);
      return;
    }
    // 非 iOS 裝置走到這（罕見）→ 用 alpha fallback
    if (typeof e.alpha === "number") {
      setHeading(alphaToCompassHeading(e.alpha, getScreenOrientationAngle()));
      setIsAbsolute(e.absolute === true);
    }
  }, []);

  /** attach 監聽 — Android 優先用 deviceorientationabsolute（絕對方位） */
  const attach = useCallback(() => {
    // 先清舊的（避免重複）
    cleanupRef.current?.();

    const hasAbsoluteEvent = "ondeviceorientationabsolute" in window;
    if (hasAbsoluteEvent) {
      // Android Chrome：deviceorientationabsolute 的 alpha 保證是絕對方位
      const absHandler = (e: Event) => {
        const oe = e as DeviceOrientationEvent;
        if (typeof oe.alpha === "number") {
          setHeading(alphaToCompassHeading(oe.alpha, getScreenOrientationAngle()));
          setIsAbsolute(true);
        }
      };
      window.addEventListener("deviceorientationabsolute", absHandler, {
        passive: true,
      });
      // 同時掛一般事件當 fallback（部分裝置 absolute 事件不觸發），
      // 但只在還沒拿到 absolute 讀值時採用（絕對值優先、不互相蓋）
      let gotAbsolute = false;
      const markAbs = (e: Event) => {
        if ((e as DeviceOrientationEvent).alpha != null) gotAbsolute = true;
      };
      window.addEventListener("deviceorientationabsolute", markAbs, {
        passive: true,
      });
      const relHandler = (e: DeviceOrientationEvent) => {
        if (gotAbsolute) return;
        handleIos(e);
      };
      window.addEventListener("deviceorientation", relHandler, { passive: true });
      cleanupRef.current = () => {
        window.removeEventListener("deviceorientationabsolute", absHandler);
        window.removeEventListener("deviceorientationabsolute", markAbs);
        window.removeEventListener("deviceorientation", relHandler);
        cleanupRef.current = null;
      };
    } else {
      // iOS / 其他：deviceorientation（iOS 用 webkitCompassHeading）
      window.addEventListener("deviceorientation", handleIos, { passive: true });
      cleanupRef.current = () => {
        window.removeEventListener("deviceorientation", handleIos);
        cleanupRef.current = null;
      };
    }
  }, [handleIos]);

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
    attach();
    setGranted(true);
    return () => {
      cleanupRef.current?.();
    };
  }, [supported, attach]);

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
        attach();
        setGranted(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [supported, attach]);

  return { heading, supported, granted, request, isAbsolute };
}
