// 📲 HostJoinQr — 大螢幕常駐「玩家加入」QR（2026-07-05 UX）
//
// 背景：原本 HostScreen 有 host_* page 時完全不顯示玩家加入 QR，
//   現場參加者只能靠 admin 另外列印 QR 才能入場。此元件讓大螢幕角落
//   常駐一個可收合的加入 QR + 短網址，掃大螢幕即可進場。
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, X } from "lucide-react";

interface HostJoinQrProps {
  /** 玩家加入路徑（如 /play/:sessionId）*/
  playPath: string;
}

export default function HostJoinQr({ playPath }: HostJoinQrProps) {
  const [open, setOpen] = useState(true);
  const [dataUrl, setDataUrl] = useState<string>("");
  const joinUrl = `${window.location.origin}${playPath}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        /* QR 產生失敗不影響大螢幕主流程 */
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-zinc-900/90 border border-zinc-700 px-4 py-2 text-sm text-zinc-200 shadow-lg hover:bg-zinc-800"
        data-testid="host-join-qr-toggle"
      >
        <QrCode className="w-4 h-4" /> 加入 QR
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 rounded-xl bg-zinc-900/95 border border-zinc-700 p-3 shadow-2xl backdrop-blur"
      data-testid="host-join-qr"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-300">📲 掃碼加入</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400"
          aria-label="收合加入 QR"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {dataUrl ? (
        <img src={dataUrl} alt="玩家加入 QR" className="w-40 h-40 rounded bg-white p-1" />
      ) : (
        <div className="w-40 h-40 rounded bg-zinc-800 animate-pulse" />
      )}
      <p className="mt-2 text-[10px] text-emerald-400 text-center break-all max-w-40">
        {joinUrl.replace(/^https?:\/\//, "")}
      </p>
      <p className="text-[10px] text-zinc-500 text-center">免登入・掃碼即玩</p>
    </div>
  );
}
