// 📜 全站宣告 footer 掛載器（CHITO c45e8915 第 2 修）
// 業主需求：「每個頁面下方」都要有五份宣告連結（使用條款/隱私權政策/免責聲明/活動風險/版權聲明）。
// 第 1 修只掛在活動模板市集一頁 → 測試員回報「未看到入口」，改為全域掛載。
//
// 例外（沉浸式全螢幕頁）：這些頁面沒有可捲動的頁尾、且底部是操作區，
// 掛上會遮住按鈕或造成雙捲軸 → 一律不顯示。
import { useLocation } from "wouter";
import LegalFooter from "@/components/LegalFooter";

/** 不掛 footer 的沉浸式路徑 */
const IMMERSIVE_PATTERNS: RegExp[] = [
  /^\/game\/[^/]+$/,                 // 遊玩中（legacy 路徑）
  /^\/f\/[^/]+\/game\/[^/]+$/,       // 遊玩中（場域路徑）
  /^\/map\//,                        // GPS 地圖導航
  /^\/f\/[^/]+\/map\//,
  /^\/host\//,                       // 活動大螢幕
  /^\/play\//,                       // 活動玩家端互動
  /^\/liff\/play\//,
  /^\/pos\/scan/,                    // POS 掃碼（相機全螢幕）
  /^\/g\//,                          // QR 短連結轉址頁
  /^\/j\//,
  /^\/b\//,
];

/** 該路徑是否為沉浸式頁面（不掛 footer）— 導出供測試驗證 */
export function isImmersivePath(path: string): boolean {
  return IMMERSIVE_PATTERNS.some((re) => re.test(path));
}

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
