// 📱 對講機群組 QR Code 顯示
//
// QR 內容格式：`WALKIE:{accessCode}`
// （未來 Stage 2 可改成 `https://game.homi.cc/j/{code}` 短連結而保持向下相容）
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface WalkieQRCodeProps {
  code: string;
  size?: number;
}

export function WalkieQRCode({ code, size = 200 }: WalkieQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setDataUrl(null);
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(`WALKIE:${code}`, {
          width: size * 2, // 2x for retina
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setDataUrl(url);
      } catch (err) {
        if (!cancelled) setError("QR 生成失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, size]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center text-xs text-destructive bg-muted rounded"
        style={{ width: size, height: size }}
      >
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded"
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded p-2 inline-block"
      style={{ width: size + 16, height: size + 16 }}
    >
      <img
        src={dataUrl}
        alt={`對講機代碼 ${code}`}
        width={size}
        height={size}
        className="block"
      />
    </div>
  );
}
