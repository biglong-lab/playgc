// 📱 PwaInstallEntry — 使用者主動安裝 PWA 入口
//
// 設計動機（2026-05-02）：
//   - 自動 PWAInstallPrompt 設了 30 天冷靜期 + 「不再提示」永久關閉
//   - 但使用者「需要時」仍能找到入口 → 放在「我的」頁面
//   - 不擾人，主動找才出現
//
// 環境差異：
//   - Android Chrome / Edge：beforeinstallprompt → 直接 prompt()
//   - iOS Safari：沒有 prompt API → 顯示教學 dialog（「分享 → 加入主畫面」）
//   - 已 standalone：完全不顯示
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Smartphone, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function PwaInstallEntry() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosDialogOpen, setIosDialogOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // 不呼叫 e.preventDefault() 讓自動 PWAInstallPrompt 也能拿到（不會 race，事件 reference 共用）
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 已安裝（standalone）→ 不顯示入口
  if (installed) return null;

  const onIOS = isIOS();

  // 既不是 iOS 也沒有 deferredPrompt → 此瀏覽器不支援 PWA 安裝（如桌面 Firefox），不顯示
  if (!onIOS && !deferredPrompt) return null;

  const handleClick = async () => {
    if (onIOS) {
      setIosDialogOpen(true);
      return;
    }
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* 使用者取消，無 action */
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors text-left"
        data-testid="btn-pwa-install-entry"
      >
        <div className="bg-primary/15 text-primary rounded-lg p-2 shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">📱 加入主畫面</div>
          <p className="text-xs text-muted-foreground">
            把 CHITO 變成 App，下次直接一鍵開啟
          </p>
        </div>
      </button>

      {/* iOS 教學 Dialog（Safari 沒有 prompt API，必須手動操作）*/}
      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="ios-pwa-install-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              加到 iPhone 主畫面
            </DialogTitle>
            <DialogDescription>
              iOS 需要在 Safari 中手動加入，步驟如下：
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <span className="bg-primary/15 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">
                1
              </span>
              <div className="flex-1">
                點下方 <Share className="inline w-4 h-4 mx-0.5 text-blue-500" /> 分享按鈕
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/15 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">
                2
              </span>
              <div className="flex-1">
                往下滑找到 <span className="font-medium">「加入主畫面」</span>
                <Plus className="inline w-4 h-4 mx-0.5 text-muted-foreground" />
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/15 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold shrink-0">
                3
              </span>
              <div className="flex-1">
                右上角點「<span className="font-medium">加入</span>」完成
              </div>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            💡 必須在 Safari 瀏覽器中操作，其他 App 內建瀏覽器（如 LINE / Facebook）不支援
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIosDialogOpen(false)}
            data-testid="btn-ios-pwa-dialog-close"
          >
            知道了
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
