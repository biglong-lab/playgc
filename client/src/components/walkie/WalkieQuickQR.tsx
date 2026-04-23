// 📱 對講機快速 QR 浮窗
//
// 從 WalkiePill 旁的 QR 按鈕觸發，顯示大 QR + 代碼 + 分享按鈕
// 不進入完整面板，點空白/按 X 即關閉
//
// 與 WalkieFloatingButton 展開面板互斥（主要給「已加群組，只想快速給人掃」的情境）
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Copy, Check } from "lucide-react";
import { WalkieQRCode, buildWalkieShareUrl } from "./WalkieQRCode";

interface WalkieQuickQRProps {
  open: boolean;
  accessCode: string | null;
  groupName?: string | null;
  onClose: () => void;
  onShare?: () => void;
  copied?: boolean;
  onCopy?: () => void;
}

export function WalkieQuickQR({
  open,
  accessCode,
  groupName,
  onClose,
  onShare,
  copied = false,
  onCopy,
}: WalkieQuickQRProps) {
  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && accessCode && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 2147483647 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="walkie-quick-qr-overlay"
        >
          <motion.div
            className="bg-card border rounded-2xl shadow-2xl p-6 w-full max-w-sm relative"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 關閉按鈕 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-accent flex items-center justify-center"
              aria-label="關閉"
              data-testid="walkie-quick-qr-close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 標題 */}
            <div className="text-center mb-4 pr-8">
              <h3 className="font-display font-bold text-lg">邀請朋友加入</h3>
              {groupName && (
                <p className="text-xs text-muted-foreground mt-0.5">{groupName}</p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <WalkieQRCode code={accessCode} size={220} />
            </div>

            {/* 代碼 */}
            <div className="bg-muted rounded-lg p-3 text-center mb-4">
              <p className="text-xs text-muted-foreground mb-1">群組代碼</p>
              <p className="font-mono text-2xl font-bold tracking-widest">
                {accessCode}
              </p>
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-2">
              {onCopy && (
                <button
                  onClick={onCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border hover:bg-accent transition-colors text-sm font-medium"
                  data-testid="walkie-quick-qr-copy"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      複製代碼
                    </>
                  )}
                </button>
              )}
              {onShare && (
                <button
                  onClick={onShare}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                  data-testid="walkie-quick-qr-share"
                >
                  <Share2 className="w-4 h-4" />
                  分享連結
                </button>
              )}
            </div>

            {/* 提示 */}
            <p className="text-xs text-muted-foreground text-center mt-3">
              朋友掃此 QR 或輸入代碼即可加入
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
