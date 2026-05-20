import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isPwa: boolean;
  isIos: boolean;
  isAndroid: boolean;
  width: number;
  height: number;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function detectIsPwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("launch")?.startsWith("pwa")) return true;
  } catch {
    // ignore
  }
  return false;
}

function detectIsTouch(): boolean {
  if (typeof window === "undefined") return false;
  if ("ontouchstart" in window) return true;
  if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
  return false;
}

function detectPlatform(ua: string): { isIos: boolean; isAndroid: boolean } {
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && detectIsTouch());
  const isAndroid = /android/i.test(ua);
  return { isIos, isAndroid };
}

function classify(width: number, isTouch: boolean, ua: string): DeviceType {
  const looksLikePhoneUa = /iphone|ipod|android.*mobile/i.test(ua);
  const looksLikeTabletUa = /ipad|tablet|android(?!.*mobile)/i.test(ua);

  if (looksLikePhoneUa) return "mobile";
  if (looksLikeTabletUa) return "tablet";

  // 🆕 2026-05-20：iPad iOS 13+ 偽裝成 Macintosh、寬度可達 1366 (iPad Pro 12.9)
  // 之前會被誤判為 desktop、平板開放後必須補
  if (isTouch && /Macintosh/i.test(ua)) return "tablet";

  if (width <= MOBILE_MAX) return isTouch ? "mobile" : "desktop";
  if (width <= TABLET_MAX) return isTouch ? "tablet" : "desktop";
  // 寬度 > 1023 但仍有 touch（如 Surface / iPad Pro 13）→ 視為平板
  if (isTouch) return "tablet";
  return "desktop";
}

function read(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      type: "desktop",
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouch: false,
      isPwa: false,
      isIos: false,
      isAndroid: false,
      width: 1024,
      height: 768,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch = detectIsTouch();
  const isPwa = detectIsPwa();
  const ua = navigator.userAgent || "";
  const { isIos, isAndroid } = detectPlatform(ua);
  const type = classify(width, isTouch, ua);
  return {
    type,
    isMobile: type === "mobile",
    isTablet: type === "tablet",
    isDesktop: type === "desktop",
    isTouch,
    isPwa,
    isIos,
    isAndroid,
    width,
    height,
  };
}

export function useDeviceType(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() => read());

  useEffect(() => {
    const onChange = () => setInfo(read());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    const mql = window.matchMedia?.("(display-mode: standalone)");
    mql?.addEventListener?.("change", onChange);
    setInfo(read());
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      mql?.removeEventListener?.("change", onChange);
    };
  }, []);

  return info;
}

export function useIsMobile(): boolean {
  return useDeviceType().isMobile;
}

export function useIsPwa(): boolean {
  return useDeviceType().isPwa;
}
