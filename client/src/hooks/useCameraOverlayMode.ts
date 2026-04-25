// 🎥 相機沉浸模式 — mount 時告訴全域元件「我在拍照」
//
// 用途：
//   全螢幕相機 view 在使用時，浮動 UI（如對講機 Pill / QR 圓鈕）
//   應該自動隱藏，避免擋住切鏡頭、快門等按鈕
//
// 機制：
//   set document.body.dataset.cameraActive = "true"
//   全域元件透過 MutationObserver 監聽此 flag → 自動隱藏
//
import { useEffect } from "react";

/**
 * 在使用全螢幕相機 view 時呼叫此 hook
 * mount 時 set body flag，unmount 時清除
 *
 * 多個 active camera view 共存時用 counter 累加
 */
let activeCameraCount = 0;

export function useCameraOverlayMode(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;

    activeCameraCount += 1;
    document.body.dataset.cameraActive = "true";

    return () => {
      activeCameraCount = Math.max(0, activeCameraCount - 1);
      if (activeCameraCount === 0) {
        delete document.body.dataset.cameraActive;
      }
    };
  }, [active]);
}
