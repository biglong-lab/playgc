// 📍 GpsMissionPage 內嵌備援驗證 UI
//
// 用途：GPS 失效時玩家可用代碼 / QR 完成簽到
// 為何獨立元件：GpsMissionPage 用 config-driven 純前端比對、不走後端 visit endpoint
//             所以不能直接套 LocationVerifier（那是後端 visit 流程）
// 比對對象：config.fallbackQrCode（純字串比對、不分大小寫）
//
// 2026-05-22

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, KeyRound, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** admin 設定的備援代碼（也用於 QR 內含字串）*/
  expectedCode: string;
  /** 玩家通過時觸發 */
  onPass: () => void;
  /** 取消顯示 fallback */
  onCancel?: () => void;
}

export function InlineCodeFallback({ expectedCode, onPass, onCancel }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"choose" | "code" | "qr">("choose");
  const [code, setCode] = useState("");

  const compare = (input: string) => {
    const a = input.trim().toUpperCase();
    const b = expectedCode.trim().toUpperCase();
    // 比對成功；也支援掃到的 QR 內含 `LOC:CODE` 或 JSON `{ code: "..." }`
    if (a === b) return true;
    // JSON 含 code 欄位
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed?.code === "string" && parsed.code.trim().toUpperCase() === b) return true;
    } catch {
      /* not JSON */
    }
    // `LOC:XXX` 格式
    if (a.startsWith("LOC:") && a.substring(4) === b) return true;
    return false;
  };

  const submit = () => {
    if (!code.trim()) {
      toast({ title: "請輸入代碼", variant: "destructive" });
      return;
    }
    if (compare(code)) {
      toast({ title: "✅ 代碼正確", description: "備援驗證成功" });
      onPass();
    } else {
      toast({ title: "代碼錯誤", description: "請確認代碼是否正確", variant: "destructive" });
    }
  };

  if (mode === "qr") {
    // 動態 import 掃描器，避免 lazy load 整個 LocationVerifier
    return <QrFallbackScanner onDetect={(text) => {
      if (compare(text)) {
        toast({ title: "✅ QR 驗證成功" });
        onPass();
      } else {
        toast({ title: "QR 不對應", description: "請對準正確的任務點 QR", variant: "destructive" });
      }
    }} onClose={() => setMode("choose")} />;
  }

  return (
    <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" data-testid="inline-code-fallback">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">無法定位？用備援方式</p>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} aria-label="取消">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setMode("qr")}
              data-testid="button-fallback-qr"
            >
              <QrCode className="w-4 h-4 mr-2" />
              掃 QR
            </Button>
            <Button
              variant="outline"
              onClick={() => setMode("code")}
              data-testid="button-fallback-code"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              輸入代碼
            </Button>
          </div>
        )}

        {mode === "code" && (
          <div className="space-y-2">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="現場代碼"
              maxLength={10}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="font-mono uppercase text-center text-lg tracking-widest"
              data-testid="input-fallback-code"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setMode("choose")} className="flex-1">
                返回
              </Button>
              <Button onClick={submit} className="flex-1" data-testid="button-submit-fallback-code">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                確認
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────
// 簡易 QR 掃描器（接受任何文字、由父元件比對）
// ─────────────────────────────────────────────────────

interface ScannerProps {
  onDetect: (text: string) => void;
  onClose: () => void;
}

function QrFallbackScanner({ onDetect, onClose }: ScannerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scannerInstance, setScannerInstance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 用 ref callback 啟動掃描器
  const containerRef = (el: HTMLDivElement | null) => {
    if (!el || scannerInstance) return;
    el.id = "fallback-qr-reader";
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      const instance = new Html5Qrcode("fallback-qr-reader");
      setScannerInstance(instance);
      instance
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => onDetect(text),
          () => {},
        )
        .catch((err: unknown) => {
          setError((err as Error)?.message || "相機啟動失敗");
        });
    });
  };

  // 關閉時停掉相機
  const handleClose = () => {
    if (scannerInstance && scannerInstance.isScanning) {
      scannerInstance.stop().then(() => scannerInstance.clear()).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b">
        <span className="font-medium">📷 掃描任務點 QR</span>
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="關閉">
          <X className="w-5 h-5" />
        </Button>
      </div>
      <div className="flex-1 relative bg-black">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white px-6">
            <p className="text-center">{error}</p>
            <Button onClick={handleClose} variant="outline">
              關閉
            </Button>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
