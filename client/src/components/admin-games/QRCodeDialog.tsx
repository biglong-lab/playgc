// QR Code 對話框元件
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Download, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: {
    id: string;
    title: string;
    publicSlug: string | null;
    qrCodeUrl: string | null;
  } | null;
  onGenerate: (id: string, regenerateSlug?: boolean) => void;
  isPending: boolean;
}

export default function QRCodeDialog({
  open,
  onOpenChange,
  game,
  onGenerate,
  isPending,
}: QRCodeDialogProps) {
  const { toast } = useToast();
  const [copiedUrl, setCopiedUrl] = useState(false);

  function copyGameUrl(slug: string) {
    const baseUrl = window.location.origin;
    const gameUrl = `${baseUrl}/g/${slug}`;
    navigator.clipboard.writeText(gameUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({ title: "已複製遊戲連結" });
  }

  function downloadQRCode(qrCodeUrl: string, title: string) {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `${title}-qrcode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            遊戲 QR Code
          </DialogTitle>
          <DialogDescription>
            {game?.title}
          </DialogDescription>
        </DialogHeader>
        {game && (
          <div className="space-y-4 py-4">
            {game.qrCodeUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={game.qrCodeUrl}
                  alt="QR Code"
                  className="w-48 h-48 border rounded-lg p-2 bg-white"
                  data-testid="img-qrcode"
                />
                <div className="flex items-center gap-2 w-full">
                  <Input
                    value={`${window.location.origin}/g/${game.publicSlug}`}
                    readOnly
                    className="text-sm"
                    data-testid="input-game-url"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyGameUrl(game.publicSlug!)}
                    data-testid="button-copy-url"
                  >
                    {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`/g/${game.publicSlug}`, '_blank')}
                    data-testid="button-open-game"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => downloadQRCode(game.qrCodeUrl!, game.title)}
                    data-testid="button-download-qr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下載 QR Code
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onGenerate(game.id, true)}
                    disabled={isPending}
                    data-testid="button-regenerate-qr"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">尚未產生 QR Code</p>
                <Button
                  onClick={() => onGenerate(game.id)}
                  disabled={isPending}
                  data-testid="button-generate-qr-dialog"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  產生 QR Code
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
