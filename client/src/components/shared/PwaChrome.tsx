import { useEffect } from "react";
import { useDeviceType } from "@/hooks/useDeviceType";

/**
 * PwaChrome — 手機 Web vs PWA 差異化的「全域模式標記」
 *
 * 不渲染 UI（既有 PlayerBottomNav 已負責底部導覽）。
 * 只在 <html> 上掛 data-app-mode + data-device-type、讓 CSS 用屬性選擇器分支樣式。
 *
 * 用法（CSS）：
 *   html[data-app-mode="pwa"] body { padding-top: env(safe-area-inset-top); }
 *   html[data-device-type="desktop"] .mobile-only { display: none; }
 */
export default function PwaChrome() {
  const device = useDeviceType();

  useEffect(() => {
    const root = document.documentElement;
    const mode = device.isPwa ? "pwa" : "web";
    root.setAttribute("data-app-mode", mode);
    root.setAttribute("data-device-type", device.type);
    if (device.isPwa) {
      root.classList.add("pwa-mode");
      root.classList.remove("web-mode");
    } else {
      root.classList.add("web-mode");
      root.classList.remove("pwa-mode");
    }
    return () => {
      root.removeAttribute("data-app-mode");
      root.removeAttribute("data-device-type");
    };
  }, [device.isPwa, device.type]);

  return null;
}
