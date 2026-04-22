// 📷 對講機群組 QR 掃描器
//
// 用 html5-qrcode，掃到 `WALKIE:XXX` 格式就提取 code callback 給父元件
// 也接受純 6 碼格式（容錯）
import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- html5-qrcode 動態 import，型別複雜
type Html5QrcodeInstance = any;

interface WalkieQRScannerProps {
  /** 掃到有效對講機代碼時觸發 */
  onDetect: (code: string) => void;
  /** 關閉掃碼器 */
  onClose: () => void;
}

function extractCode(raw: string): string | null {
  const trimmed = raw.trim();
  // 格式 1: WALKIE:XXX
  if (trimmed.toUpperCase().startsWith("WALKIE:")) {
    const code = trimmed.substring(7).toUpperCase().replace(/\s+/g, "");
    return code.length >= 4 && code.length <= 10 ? code : null;
  }
  // 格式 2: https://game.homi.cc/j/XXX（未來短連結）
  const linkMatch = trimmed.match(/\/j\/([A-Z0-9]{4,10})/i);
  if (linkMatch) return linkMatch[1].toUpperCase();
  // 格式 3: 純 4-10 字母數字（直接當 accessCode）
  if (/^[A-Z0-9]{4,10}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export function WalkieQRScanner({ onDetect, onClose }: WalkieQRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null); // Html5Qrcode instance
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    let instance: Html5QrcodeInstance = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;

        const divId = "walkie-qr-reader";
        containerRef.current.id = divId;
        instance = new Html5Qrcode(divId);
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (!mounted) return;
            const code = extractCode(decodedText);
            if (code) {
              setDetecting(true);
              onDetect(code);
            }
          },
          () => {
            // 每個 frame 沒掃到會呼叫，吃掉
          },
        );
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "無法啟動相機（請允許相機權限）",
          );
        }
      }
    })();

    return () => {
      mounted = false;
      if (instance && instance.isScanning) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b">
        <div className="flex items-center gap-2">
          <span className="font-medium">📷 掃描對講機群組 QR</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-accent"
          data-testid="walkie-qr-close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex-1 relative bg-black">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white px-6">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
            <div className="text-center">
              <div className="font-medium">相機無法啟動</div>
              <div className="text-sm text-white/70 mt-1">{error}</div>
              <div className="text-xs text-white/60 mt-3">
                請在瀏覽器設定中允許此網站使用相機
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ backgroundColor: "black" }}
            />
            {/* Scan overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-56 h-56 border-2 border-white/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
            <div className="absolute bottom-10 left-0 right-0 text-center text-white text-sm px-6">
              {detecting ? "✅ 已掃描，加入中..." : "把相機對準 QR code"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
