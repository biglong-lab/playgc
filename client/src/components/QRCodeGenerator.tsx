import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, RefreshCw, Loader2, QrCode, Check } from "lucide-react";

interface QRCodeGeneratorProps {
  qrCodeId: string;
  gameId: string;
  pageId: string;
}

export default function QRCodeGenerator({ qrCodeId, gameId, pageId }: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQRCode = async () => {
    if (!qrCodeId) {
      setError("請先輸入 QR Code ID");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const QRCode = await import("qrcode");
      const qrData = JSON.stringify({
        type: "game_qr",
        gameId,
        pageId,
        qrCodeId,
        timestamp: Date.now(),
      });

      const url = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      });

      setQrCodeUrl(url);
    } catch (err) {
      setError("生成 QR Code 失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (qrCodeId) {
      generateQRCode();
    }
  }, [qrCodeId, gameId, pageId]);

  const handleDownload = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `QR-${qrCodeId}-${pageId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!qrCodeId) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <QrCode className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          輸入 QR Code ID 後自動生成
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">QR Code 預覽</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={generateQRCode}
            disabled={isGenerating}
            data-testid="button-regenerate-qr"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {qrCodeUrl && (
        <Card className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-center bg-white rounded-lg p-4">
              <img
                src={qrCodeUrl}
                alt={`QR Code: ${qrCodeId}`}
                className="w-48 h-48"
                data-testid="img-generated-qr"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleDownload}
              data-testid="button-download-qr"
            >
              <Download className="h-4 w-4 mr-2" />
              下載 QR Code
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-500" />
              <span>ID: {qrCodeId}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
