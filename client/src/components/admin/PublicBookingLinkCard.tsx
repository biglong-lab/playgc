// 🔗 PublicBookingLinkCard — admin/bookings 對外預約連結卡（#1 / 2026-05-17）
//
// 用途：
//   業主開 admin/bookings 後可直接複製公開預約連結給客戶
//   加 QR Code 供印傳單 / 海報、列出「我的預約」連結供老客戶查詢
//
// 對應業主回報：
//   - 「預約管理要用什麼連結對外使用？請將連結做在頁面上」
//   - 「顯示此場域尚未開通預約功能？」→ 加 config 檢查避免露出無效連結

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink, QrCode, Download, AlertTriangle, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface PublicBookingLinkCardProps {
  /** 場域代碼（用於對外 URL 路徑、給玩家掃 QR 進入）*/
  fieldCode: string | null;
  /** 場域 ID（用於 admin API 檢查 booking config）*/
  fieldId: string | null;
}

export default function PublicBookingLinkCard({ fieldCode, fieldId }: PublicBookingLinkCardProps) {
  const { toast } = useToast();
  const [copiedBook, setCopiedBook] = useState(false);
  const [copiedMine, setCopiedMine] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // 🆕 2026-05-17：查場域是否已開通預約（避免露出無效連結）
  const { data: bookingConfig, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ["admin-booking-config-link", fieldId],
    queryFn: async () => {
      if (!fieldId) return null;
      try {
        return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/config`);
      } catch (e) {
        // 與 ConfigPanel 同邏輯：只在 not_initialized 才視為未開通
        // 其他錯誤（網路 / auth）throw 給 useQuery 處理、避免誤判
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("not_initialized")) return null;
        throw e;
      }
    },
    enabled: !!fieldId,
    retry: false,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookUrl = fieldCode ? `${origin}/book/${fieldCode}` : null;
  const mineUrl = fieldCode ? `${origin}/book/${fieldCode}/mine` : null;
  // 已開通 = data 不為 null（200 + body）OR query error 但非 not_initialized（網路問題、樂觀顯示）
  const isBookingEnabled = !!bookingConfig;

  // 自動生成 QR Code（場域已開通才生）
  useEffect(() => {
    if (!bookUrl || !isBookingEnabled) return;
    let cancelled = false;
    setQrLoading(true);
    (async () => {
      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(bookUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });
        if (!cancelled) setQrUrl(dataUrl);
      } catch (err) {
        console.warn("[PublicBookingLinkCard] QR 生成失敗:", err);
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookUrl, isBookingEnabled]);

  const copy = async (url: string, type: "book" | "mine") => {
    try {
      await navigator.clipboard.writeText(url);
      if (type === "book") {
        setCopiedBook(true);
        setTimeout(() => setCopiedBook(false), 2000);
      } else {
        setCopiedMine(true);
        setTimeout(() => setCopiedMine(false), 2000);
      }
      toast({ title: "已複製連結", description: url });
    } catch {
      toast({ title: "複製失敗", description: "請手動選取複製", variant: "destructive" });
    }
  };

  const downloadQr = () => {
    if (!qrUrl || !fieldCode) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `booking-qr-${fieldCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "QR Code 已下載", description: `booking-qr-${fieldCode}.png` });
  };

  // 沒 fieldCode → 顯示警示
  if (!fieldCode) {
    return (
      <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">尚未設定場域代碼</p>
            <p className="text-sm text-muted-foreground">
              請在「場域設定」頁面設定 fieldCode、才能對外開放預約連結。
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 載入中 → skeleton
  if (configLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground" role="status" aria-live="polite">
          檢查預約功能狀態…
        </CardContent>
      </Card>
    );
  }

  // 🆕 2026-05-17：場域尚未開通預約 → 隱藏連結、顯示開通提示
  if (!isBookingEnabled) {
    return (
      <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
        <CardContent className="p-4 flex items-start gap-3" role="status" aria-live="polite">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">此場域尚未開通預約功能</p>
            <p className="text-sm text-muted-foreground mb-2">
              請先切到「⚙️ 場域設定」分頁、點「用賈村預設模板初始化」開通預約後、本卡片才會顯示對外連結與 QR Code。
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const tab = document.querySelector('[data-testid="tab-config"]') as HTMLElement | null;
                tab?.click();
              }}
              data-testid="btn-goto-config-tab"
              aria-label="切到場域設定分頁開通預約"
            >
              <Settings className="w-4 h-4 mr-1" aria-hidden="true" />
              前往場域設定
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-primary" aria-hidden="true" />
          對外預約連結
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 對外預約連結 */}
        <div>
          <label className="text-sm font-medium mb-2 block">客戶預約連結（公開）</label>
          <div className="flex gap-2">
            <Input
              value={bookUrl ?? ""}
              readOnly
              className="font-mono text-sm"
              data-testid="input-public-booking-url"
              aria-label="客戶預約連結"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => bookUrl && copy(bookUrl, "book")}
              data-testid="btn-copy-booking-url"
              aria-label={copiedBook ? "已複製" : "複製預約連結"}
            >
              {copiedBook ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              data-testid="btn-open-booking-url"
            >
              <a href={bookUrl ?? "#"} target="_blank" rel="noopener noreferrer" aria-label="在新分頁開啟預約連結">
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>

        {/* 「我的預約」連結 */}
        <div>
          <label className="text-sm font-medium mb-2 block">查詢「我的預約」連結（給老客戶）</label>
          <div className="flex gap-2">
            <Input
              value={mineUrl ?? ""}
              readOnly
              className="font-mono text-sm"
              data-testid="input-my-booking-url"
              aria-label="查詢我的預約連結"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => mineUrl && copy(mineUrl, "mine")}
              data-testid="btn-copy-my-booking-url"
              aria-label={copiedMine ? "已複製" : "複製查詢連結"}
            >
              {copiedMine ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>

        {/* QR Code */}
        <div>
          <label className="text-sm font-medium mb-2 block">QR Code（供印傳單 / 海報）</label>
          <div className="flex items-center gap-4">
            {qrLoading ? (
              <div
                className="w-[200px] h-[200px] flex items-center justify-center bg-muted rounded text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                生成中…
              </div>
            ) : qrUrl ? (
              <img
                src={qrUrl}
                alt={`場域 ${fieldCode} 的預約 QR Code、可用手機掃描預約`}
                className="w-[200px] h-[200px] border rounded"
                data-testid="img-booking-qr"
              />
            ) : (
              <div
                className="w-[200px] h-[200px] flex items-center justify-center bg-muted rounded text-xs text-muted-foreground"
                role="status"
              >
                QR 生成失敗
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadQr}
                disabled={!qrUrl}
                data-testid="btn-download-qr"
                aria-label="下載 QR Code 圖片"
              >
                <Download className="w-4 h-4 mr-1" aria-hidden="true" />
                下載 PNG
              </Button>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                客戶掃描 QR 直接進入預約頁面、適合貼在店面 / 海報 / 名片
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
