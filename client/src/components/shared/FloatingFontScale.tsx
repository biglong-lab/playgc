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
    // 🆕 2026-05-09：會員中心 hero 區右上有登出按鈕、FloatingFontScale 會蓋住
    pathname.startsWith("/me") ||
    // 🆕 2026-05-07：遊戲頁 / 活動頁 / 公開分享有自己的 header
    // FloatingFontScale 右上角會跟 header 重疊 → 這些頁面隱藏
    /\/game\/|\/map\/|\/team\/|\/match\//.test(pathname) ||
    /^\/play\//.test(pathname) ||
    /^\/g\//.test(pathname) ||
    pathname.startsWith("/squad/")
  );
}

export default function FloatingFontScale() {
  const [location] = useLocation();
  if (shouldHide(location)) return null;
  return (
    <div
      // 🆕 2026-05-07 RWD：top 加 safe-area、避開 iPhone 瀏海 / 狀態列
      className="fixed right-2 z-40 pointer-events-auto print:hidden"
      style={{ top: "calc(0.5rem + env(safe-area-inset-top))" }}
      data-testid="floating-font-scale"
    >
      <FontScaleSwitcher />
    </div>
  );
}
