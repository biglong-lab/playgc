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
  /** 相機啟動失敗時的替代流程（例：切到手動輸入） */
  onSwitchToManual?: () => void;
}

/** 把 MediaError 轉成友好中文訊息 */
function parseScanError(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  const message = (err as { message?: string })?.message || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "相機權限被拒絕\n請在瀏覽器設定允許此網站使用相機";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "此裝置找不到相機";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "相機被其他 App 佔用\n請先關閉 LINE/微信視訊、其他相機 app";
  }
  if (name === "SecurityError") {
    return "需要 HTTPS 才能用相機";
  }
  if (message.toLowerCase().includes("permission")) {
    return "請允許相機權限";
  }
  return message || "無法啟動相機（未知錯誤）";
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

export function WalkieQRScanner({
  onDetect,
  onClose,
  onSwitchToManual,
}: WalkieQRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null); // Html5Qrcode instance
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // 改變值來重啟 scanner

  useEffect(() => {
    let mounted = true;
    let instance: Html5QrcodeInstance = null;
    let startTimeout: ReturnType<typeof setTimeout> | null = null;

    const tryStart = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;

        const divId = "walkie-qr-reader";
        containerRef.current.id = divId;
        instance = new Html5Qrcode(divId);
        scannerRef.current = instance;

        // 先試後鏡頭，失敗再 fallback 任意可用相機
        const configs = [
          { facingMode: "environment" },
          { facingMode: "user" }, // Android Edge 某些裝置只能抓前鏡
          true, // 完全不指定 — 讓瀏覽器挑
        ];

        let lastErr: unknown = null;
        for (const c of configs) {
          try {
            await instance.start(
              c as never,
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
            lastErr = null;
            break; // 成功啟動就跳出
          } catch (e) {
            lastErr = e;
            continue; // 試下一個 config
          }
        }
        if (lastErr) throw lastErr;

        // 🛡 超時保險：10 秒後若還沒掃到也沒實質畫面 → 提示
        startTimeout = setTimeout(() => {
          if (mounted && !detecting) {
            // 不報錯，讓用戶繼續嘗試，但記錄 log
            console.warn("[walkie-scanner] 10s passed, still scanning");
          }
        }, 10000);
      } catch (err) {
        if (mounted) {
          setError(parseScanError(err));
        }
      }
    };

    tryStart();

    return () => {
      mounted = false;
      if (startTimeout) clearTimeout(startTimeout);
      if (instance && instance.isScanning) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
    // retryKey 觸發重新啟動
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDetect, retryKey]);

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
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white px-6">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <div className="text-center">
              <div className="font-semibold text-lg">相機無法啟動</div>
              <div className="text-sm text-white/80 mt-2 whitespace-pre-line">
                {error}
              </div>
            </div>

            <div className="w-full max-w-xs space-y-2 mt-2">
              <button
                onClick={() => {
                  setError(null);
                  setRetryKey((k) => k + 1);
                }}
                className="w-full py-3 rounded-lg bg-white text-black font-medium"
              >
                🔄 再試一次
              </button>
              {onSwitchToManual && (
                <button
                  onClick={() => {
                    onClose();
                    onSwitchToManual();
                  }}
                  className="w-full py-3 rounded-lg bg-white/10 text-white font-medium border border-white/20"
                >
                  ⌨️ 改用手動輸入 6 碼
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2 text-white/70 text-sm"
              >
                關閉
              </button>
            </div>

            <div className="text-xs text-white/50 text-center mt-2 max-w-xs">
              💡 小提示：有些瀏覽器需要到設定開啟相機權限<br />
              或換用 Chrome / Safari 嘗試
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
