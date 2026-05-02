// 📸 InAppQrScanFAB — PWA 內掃 QR Code 不離開 App
//
// 解決問題：玩家在 PWA 想掃 QR 必須切回手機相機 → 相機掃完跳瀏覽器 → 跑出 PWA。
// 此元件提供 PWA 內部 QR scanner，掃到後 in-app navigate（不離開 App）。
//
// 設計依據：docs/PWA_USER_FLOW_OPTIMIZATION_V2.md Phase C
//
// 使用方式：在 Home / Landing 顯著位置 render <InAppQrScanFAB />
//   - 顯示「📸 掃描 QR」按鈕（卡片或 floating）
//   - 點擊 → Dialog 開全螢幕 QR scanner
//   - 掃到後解析 URL：
//     - 同站 /f/:code/game/:id 等 → in-app navigate
//     - 同站其他路徑 → in-app navigate
//     - 外站 URL → 確認 dialog（離開 PWA 開啟）

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Camera, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "in-app-qr-scanner";

/** 解析掃到的 QR 內容：判斷是同站 URL / 外站 URL / 純文字 */
function parseScanResult(raw: string): {
  type: "same-site-path" | "external-url" | "text";
  path?: string;
  url?: string;
  text?: string;
} {
  const trimmed = raw.trim();
  // 嘗試解析為 URL
  try {
    const url = new URL(trimmed);
    const sameSite = url.host === window.location.host;
    if (sameSite) {
      return { type: "same-site-path", path: url.pathname + url.search + url.hash };
    }
    return { type: "external-url", url: trimmed };
  } catch {
    // 非 URL — 可能純路徑「/f/JIACHUN/game/abc」或純文字
    if (trimmed.startsWith("/f/") || trimmed.startsWith("/g/")) {
      return { type: "same-site-path", path: trimmed };
    }
    return { type: "text", text: trimmed };
  }
}

interface InAppQrScanFABProps {
  /** 樣式：full button（card 區塊用）或 icon-only（fab）*/
  variant?: "card" | "icon";
  className?: string;
}

export default function InAppQrScanFAB({
  variant = "card",
  className,
}: InAppQrScanFABProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState<string | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);

  // 開 Dialog → 啟動掃描
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setExternalUrl(null);

    const start = async () => {
      // 等 DOM 就緒
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const elem = document.getElementById(SCANNER_ELEMENT_ID);
      if (!elem) {
        setError("scanner 容器未就緒");
        return;
      }

      try {
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        html5QrRef.current = scanner;
        setScanning(true);

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            // 第一次掃到就停掃 + 處理
            if (cancelled) return;
            cancelled = true;
            void handleDecoded(decoded);
          },
          () => {
            // 掃描中失敗（無 QR）— 忽略，繼續掃
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "相機啟動失敗";
        setError(msg);
        setScanning(false);
      }
    };

    const handleDecoded = async (decoded: string) => {
      try {
        await html5QrRef.current?.stop();
      } catch {
        /* ignore */
      }
      setScanning(false);

      const parsed = parseScanResult(decoded);
      if (parsed.type === "same-site-path" && parsed.path) {
        toast({
          title: "✅ 掃描成功",
          description: "正在進入遊戲...",
          duration: 2000,
        });
        setOpen(false);
        setLocation(parsed.path);
      } else if (parsed.type === "external-url" && parsed.url) {
        // 外站 URL → 確認 dialog
        setExternalUrl(parsed.url);
      } else {
        toast({
          title: "❓ 無法辨識",
          description: `掃到內容：${parsed.text || decoded}`,
          variant: "destructive",
        });
        setOpen(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [open, setLocation, toast]);

  const handleConfirmExternal = () => {
    if (externalUrl) {
      window.location.href = externalUrl;
    }
    setOpen(false);
    setExternalUrl(null);
  };

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border-2 border-dashed border-primary/30 text-primary font-medium hover:bg-primary/20 transition-colors ${className || ""}`}
          data-testid="btn-in-app-qr-scan"
        >
          <Camera className="w-5 h-5" />
          <span>📸 掃描 QR Code 進入遊戲</span>
        </button>
      ) : (
        <Button
          size="icon"
          variant="default"
          onClick={() => setOpen(true)}
          data-testid="btn-in-app-qr-scan"
          className={className}
          aria-label="掃描 QR Code"
          title="掃描 QR Code"
        >
          <Camera className="w-5 h-5" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden" data-testid="in-app-qr-scanner-dialog">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              掃描遊戲 QR Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              對準遊戲海報上的 QR Code，掃到後自動進入遊戲（不會離開 App）
            </DialogDescription>
          </DialogHeader>

          {/* QR scanner 容器 */}
          <div className="px-6 pb-6">
            {error ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground">
                  請確認已允許相機權限
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  data-testid="btn-qr-scan-close-error"
                >
                  關閉
                </Button>
              </div>
            ) : externalUrl ? (
              <div className="text-center py-6 space-y-4">
                <AlertCircle className="w-10 h-10 mx-auto text-yellow-500" />
                <div>
                  <p className="text-sm font-medium mb-2">這是外部連結</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {externalUrl}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    開啟會離開 CHITO App
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                    data-testid="btn-qr-external-cancel"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmExternal}
                    data-testid="btn-qr-external-confirm"
                  >
                    開啟連結
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  id={SCANNER_ELEMENT_ID}
                  className="w-full aspect-square bg-black rounded-lg overflow-hidden"
                  data-testid="qr-scanner-camera"
                />
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {scanning ? "📷 對準 QR Code 自動掃描" : "啟動相機中..."}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={() => setOpen(false)}
                  data-testid="btn-qr-scan-cancel"
                >
                  <X className="w-4 h-4" />
                  取消
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
