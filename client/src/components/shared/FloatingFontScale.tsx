// 🔠 FloatingFontScale — 浮動文字大小切換按鈕
// 2026-05-07：玩家全站可用、放右上角 safe-area 內
//
// 隱藏邏輯：
//   - admin / platform 後台（admin 自己有 settings card）
//   - 拍照 / QR 掃描沉浸頁（避免擋鏡頭）
//   - 對話 / 結算 dialog（避免擋彈窗）

import { useLocation } from "wouter";
import FontScaleSwitcher from "./FontScaleSwitcher";

function shouldHide(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/platform") ||
    // 拍照沉浸頁（PhotoBurst/PhotoAr 進 fullscreen）由元件自行隱藏 Floating 全域 UI
    // 此處 path 級別只擋 admin 系列
    false
  );
}

export default function FloatingFontScale() {
  const [location] = useLocation();
  if (shouldHide(location)) return null;
  return (
    <div
      className="fixed top-2 right-2 z-40 pointer-events-auto print:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      data-testid="floating-font-scale"
    >
      <FontScaleSwitcher />
    </div>
  );
}
