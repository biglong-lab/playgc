// PWA 安裝提示：攔截 beforeinstallprompt 事件，顯示客製化底部浮動卡片
//
// 🆕 2026-05-02 防擾人優化：
//   1. dismiss cooldown：7 天 → 30 天
//   2. 「不再提示」按鈕（永久關閉）
//   3. 累計訪問門檻：第 3 次訪問才彈（Visit count）
//      → 一次性訪客不打擾，回訪 ≥ 3 次代表有意圖才提示
//   4. 主動入口：使用者可在「我的」頁面手動點擊安裝
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const NEVER_KEY = "pwa-install-never-show";
const VISIT_COUNT_KEY = "pwa-install-visit-count";

const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const MIN_VISITS_BEFORE_PROMPT = 3; // 累計第 3 次訪問才彈

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function isNeverShow(): boolean {
  try {
    return localStorage.getItem(NEVER_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用時靜默忽略
  }
}

function markNeverShow() {
  try {
    localStorage.setItem(NEVER_KEY, "1");
  } catch {
    // localStorage 不可用時靜默忽略
  }
}

/** 累計訪問次數：每次模組 mount 累加 1（用於 prompt 門檻判斷）*/
function bumpVisitCount(): number {
  try {
    const cur = Number(localStorage.getItem(VISIT_COUNT_KEY)) || 0;
    const next = cur + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

// 🆕 2026-05-16 #2：iOS Safari 偵測（iOS 不觸發 beforeinstallprompt、需要手動指引）
function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isIOS && isSafari;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);

  useEffect(() => {
    // 已是 standalone 模式 → 已安裝，無需提示
    if (isStandaloneMode()) return;
    // 永久關閉 → 完全不再打擾
    if (isNeverShow()) return;
    // 30 天冷靜期內 → 不再打擾
    if (wasRecentlyDismissed()) return;

    // 累計訪問次數，未達門檻先不彈（但要監聽事件，等下次達標自然彈）
    const visitCount = bumpVisitCount();
    const visitsReached = visitCount >= MIN_VISITS_BEFORE_PROMPT;

    // 🆕 2026-05-16 #2：iOS Safari 不觸發 beforeinstallprompt、改顯示手動指引
    if (visitsReached && isIOSSafari()) {
      setIosVisible(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // 只有達到訪問門檻才顯示彈窗
      if (visitsReached) setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setIosVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 🆕 iOS Safari 專屬提示卡（手動加到主畫面）
  if (iosVisible) {
    return (
      <div
        className="fixed bottom-20 inset-x-3 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm safe-bottom"
        role="dialog"
        aria-labelledby="pwa-ios-install-title"
        aria-live="polite"
        data-testid="pwa-install-prompt-ios"
      >
        <div className="bg-card border shadow-lg rounded-xl p-4 flex items-start gap-3">
          <div className="bg-primary/10 text-primary rounded-lg p-2 shrink-0">
            <Download className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div id="pwa-ios-install-title" className="font-semibold text-sm">
              加到主畫面（iOS）
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              點下方 <span aria-label="分享圖示" className="font-bold">⎙</span> 分享圖示 → 選「加到主畫面」、下次直接點 icon 開啟。
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  markDismissed();
                  setIosVisible(false);
                }}
                data-testid="button-pwa-ios-dismiss"
                aria-label="稍後再說、30 天內不再提示"
              >
                稍後再說
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  markNeverShow();
                  setIosVisible(false);
                }}
                className="text-muted-foreground/70 hover:text-muted-foreground text-xs"
                data-testid="button-pwa-ios-never-show"
                aria-label="不再顯示安裝提示"
              >
                不再提示
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              markDismissed();
              setIosVisible(false);
            }}
            aria-label="關閉提示"
            className="text-muted-foreground hover:text-foreground p-1 -mt-1 -mr-1"
            data-testid="button-pwa-ios-close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (!visible || !deferredPrompt) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "dismissed") {
        markDismissed();
      }
    } catch {
      // 使用者取消或瀏覽器拒絕，視同 dismiss
      markDismissed();
    } finally {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
  };

  const handleNeverShow = () => {
    markNeverShow();
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div
      className="fixed bottom-20 inset-x-3 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm safe-bottom"
      role="dialog"
      aria-labelledby="pwa-install-title"
      data-testid="pwa-install-prompt"
    >
      <div className="bg-card border shadow-lg rounded-xl p-4 flex items-start gap-3">
        <div className="bg-primary/10 text-primary rounded-lg p-2 shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div id="pwa-install-title" className="font-semibold text-sm">
            加入主畫面
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            將 CHITO 加到手機桌面，下次直接一鍵開啟，體驗更順暢。
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleInstall}
              data-testid="button-pwa-install"
            >
              立即安裝
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              data-testid="button-pwa-dismiss"
            >
              稍後再說
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNeverShow}
              className="text-muted-foreground/70 hover:text-muted-foreground text-xs"
              data-testid="button-pwa-never-show"
            >
              不再提示
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="關閉"
          className="text-muted-foreground hover:text-foreground p-1 -mt-1 -mr-1"
          data-testid="button-pwa-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
