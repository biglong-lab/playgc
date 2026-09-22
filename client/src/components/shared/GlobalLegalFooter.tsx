// 📜 全站宣告 footer 掛載器（CHITO c45e8915 第 2 修）
// 業主需求：「每個頁面下方」都要有五份宣告連結（使用條款/隱私權政策/免責聲明/活動風險/版權聲明）。
// 第 1 修只掛在活動模板市集一頁 → 測試員回報「未看到入口」，改為全域掛載。
//
// 例外（沉浸式全螢幕頁）：這些頁面沒有可捲動的頁尾、且底部是操作區，
// 掛上會遮住按鈕或造成雙捲軸 → 一律不顯示。
import { useLocation } from "wouter";
import LegalFooter from "@/components/LegalFooter";
import { isImmersivePath } from "@/lib/play-routes";

// 沉浸式路徑清單已集中到 lib/play-routes（2026-09-22）；re-export 保持既有測試與引用不變
export { isImmersivePath };

export default function GlobalLegalFooter() {
  const [location] = useLocation();

  if (isImmersivePath(location)) return null;

  // 玩家端有 fixed bottom nav（手機版）→ 預留避讓高度，避免 footer 被蓋住
  return (
    <div className="pb-bottom-nav md:pb-0" data-testid="global-legal-footer">
      <LegalFooter />
    </div>
  );
}
