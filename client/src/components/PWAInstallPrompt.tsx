// PWA 安裝提示：攔截 beforeinstallprompt 事件，顯示客製化底部浮動卡片
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
// 使用者關閉後，7 天內不再顯示
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用時靜默忽略
  }
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 已是 standalone 模式 → 已安裝，無需提示
    if (isStandaloneMode()) return;
    // 近期已關閉 → 不再打擾
    if (wasRecentlyDismissed()) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

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
            將賈村競技場加到手機桌面，下次直接一鍵開啟，體驗更順暢。
          </p>
          <div className="flex gap-2 mt-3">
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
