// 📄 ScenarioQrPrint — 情境實例 QR code 列印頁（W6 D4）
//
// 用途：admin 一鍵建場後，把所有 instance 的 hostUrl/playUrl/gameUrl 印出 QR code
//      可直接列印（A4）貼在現場，玩家掃 QR 進入。
//
// 路徑：/admin/scenario-qr-print
// Query：data 為 base64-encoded JSON（避免 URL 太長），格式：
//   { displayName, instances: [{ axis, label, pageType, hostUrl?, playUrl?, gameUrl? }] }

import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, AlertCircle } from "lucide-react";

interface PrintInstance {
  axis: "host" | "multi" | "solo" | "shared";
  label: string;
  pageType: string;
  role?: string;
  hostUrl?: string;
  playUrl?: string;
  gameUrl?: string;
}

interface PrintData {
  displayName: string;
  expiresAt?: string;
  instances: PrintInstance[];
}

interface QrCard {
  instanceLabel: string;
  pageType: string;
  axis: PrintInstance["axis"];
  role?: string;
  urlLabel: string;
  url: string;
  fullUrl: string;
  qrDataUrl: string;
}

function parsePrintData(searchString: string): PrintData | null {
  const params = new URLSearchParams(searchString);
  const dataParam = params.get("data");
  if (!dataParam) return null;
  try {
    const json = decodeURIComponent(escape(atob(dataParam)));
    return JSON.parse(json) as PrintData;
  } catch (err) {
    console.error("無法解析 print data", err);
    return null;
  }
}

type UrlMode = "web" | "liff";

export default function ScenarioQrPrint() {
  const [location] = useLocation();
  const [cards, setCards] = useState<QrCard[]>([]);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [generating, setGenerating] = useState(true);
  // W14 D4: URL 模式（一般網頁 / LINE LIFF）
  const [urlMode, setUrlMode] = useState<UrlMode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("chitoQrUrlMode") : null;
    return saved === "liff" ? "liff" : "web";
  });

  const search = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.search;
  }, [location]);

  useEffect(() => {
    const data = parsePrintData(search);
    if (!data) {
      setGenerating(false);
      return;
    }
    setPrintData(data);
    setGenerating(true);
    generateAllQrs(data, urlMode).then((result) => {
      setCards(result);
      setGenerating(false);
    });
  }, [search, urlMode]);

  // 切換時存記憶
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chitoQrUrlMode", urlMode);
    }
  }, [urlMode]);

  if (!printData && !generating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h1 className="text-2xl font-display font-bold">缺少列印資料</h1>
          <p className="text-sm text-muted-foreground">
            這個頁面需要從情境一鍵建場結果跳轉、不能直接打開。
            <br />
            請回到情境模板市集重新建場，建立完成後從結果視窗點「列印 QR」。
          </p>
          <Button onClick={() => window.location.assign("/template-market")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            回情境市集
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* 螢幕版 toolbar（列印時隱藏）*/}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">📄 {printData?.displayName} QR 列印</h1>
              <p className="text-xs text-muted-foreground">
                {cards.length} 張 QR code · 直接列印或截圖
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* W14 D4: URL 模式切換 */}
            <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setUrlMode("web")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  urlMode === "web" ? "bg-white shadow text-foreground" : "text-muted-foreground"
                }`}
                data-testid="btn-url-mode-web"
              >
                🌐 一般網頁
              </button>
              <button
                onClick={() => setUrlMode("liff")}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  urlMode === "liff" ? "bg-emerald-500 text-white shadow" : "text-muted-foreground"
                }`}
                data-testid="btn-url-mode-liff"
              >
                💚 LINE
              </button>
            </div>
            <Button onClick={() => window.print()} data-testid="btn-print">
              <Printer className="w-4 h-4 mr-1" />
              列印
            </Button>
          </div>
        </div>
        {urlMode === "liff" && (
          <div className="container mx-auto px-4 pb-2 text-xs text-emerald-700">
            💚 LINE 模式：玩家 QR 改為 LIFF URL（玩家從 LINE 點開、自動帶名字）
          </div>
        )}
      </div>

      {/* 列印區域 */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {generating && (
          <div className="text-center py-12">
            <p>產生 QR code 中...</p>
          </div>
        )}

        {!generating && cards.length === 0 && printData && (
          <div className="text-center py-12 text-muted-foreground">
            這個情境沒有可列印的元件實例
          </div>
        )}

        {/* QR 卡片 — 每頁一張，列印時自動分頁 */}
        <div className="space-y-6 print:space-y-0">
          {cards.map((card, i) => (
            <QrPrintCard key={i} card={card} index={i + 1} total={cards.length} displayName={printData?.displayName ?? ""} />
          ))}
        </div>
      </main>

      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .qr-print-card { page-break-after: always; }
          .qr-print-card:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}

/**
 * W14 D4: 把玩家 URL 轉成 LIFF 格式（如選 LIFF 模式）
 * /play/:sessionId → /liff/play/:sessionId
 * 大螢幕網址不變（LIFF 不適合 host）
 */
function maybeLiffify(playUrl: string, mode: UrlMode): string {
  if (mode !== "liff") return playUrl;
  return playUrl.replace(/^\/play\//, "/liff/play/");
}

async function generateAllQrs(data: PrintData, urlMode: UrlMode): Promise<QrCard[]> {
  const cards: QrCard[] = [];
  const origin = window.location.origin;
  const liffSuffix = urlMode === "liff" ? "（LINE）" : "";

  for (const instance of data.instances) {
    if (instance.axis === "host" && instance.hostUrl && instance.playUrl) {
      // host 元件：兩張 QR（大螢幕 + 玩家）
      const hostFull = `${origin}${instance.hostUrl}`;
      const playUrlFinal = maybeLiffify(instance.playUrl, urlMode);
      const playFull = `${origin}${playUrlFinal}`;
      cards.push({
        instanceLabel: instance.label,
        pageType: instance.pageType,
        axis: instance.axis,
        role: instance.role,
        urlLabel: "📺 大螢幕（含 hostToken，請勿公開）",
        url: instance.hostUrl,
        fullUrl: hostFull,
        qrDataUrl: await QRCode.toDataURL(hostFull, { width: 600, margin: 2 }),
      });
      cards.push({
        instanceLabel: instance.label,
        pageType: instance.pageType,
        axis: instance.axis,
        role: instance.role,
        urlLabel: `📱 玩家手機端${liffSuffix}`,
        url: playUrlFinal,
        fullUrl: playFull,
        qrDataUrl: await QRCode.toDataURL(playFull, { width: 600, margin: 2 }),
      });
    } else if (instance.gameUrl) {
      const fullGameUrl = `${origin}${instance.gameUrl}`;
      cards.push({
        instanceLabel: instance.label,
        pageType: instance.pageType,
        axis: instance.axis,
        role: instance.role,
        urlLabel: instance.axis === "multi" ? "👥 玩家入口（隊伍模式）" : "👤 玩家入口",
        url: instance.gameUrl,
        fullUrl: fullGameUrl,
        qrDataUrl: await QRCode.toDataURL(fullGameUrl, { width: 600, margin: 2 }),
      });
    }
  }
  return cards;
}

function QrPrintCard({
  card,
  index,
  total,
  displayName,
}: {
  card: QrCard;
  index: number;
  total: number;
  displayName: string;
}) {
  const axisColors = {
    host: "from-blue-50 to-blue-100 border-blue-300",
    multi: "from-purple-50 to-purple-100 border-purple-300",
    solo: "from-emerald-50 to-emerald-100 border-emerald-300",
    shared: "from-zinc-50 to-zinc-100 border-zinc-300",
  };

  return (
    <div
      className={`qr-print-card border rounded-2xl p-8 bg-gradient-to-br ${axisColors[card.axis]} text-zinc-900 print:rounded-none print:border-0`}
      data-testid={`qr-card-${index}`}
    >
      <div className="text-center space-y-4">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          {displayName} · {index} / {total}
        </div>
        <h2 className="text-3xl md:text-4xl font-display font-bold">{card.instanceLabel}</h2>
        {card.role && <p className="text-sm text-zinc-600">{card.role}</p>}
        <div className="text-base font-medium">{card.urlLabel}</div>

        {/* QR */}
        <div className="flex justify-center py-4">
          <img
            src={card.qrDataUrl}
            alt={`QR for ${card.urlLabel}`}
            className="w-64 h-64 md:w-80 md:h-80 rounded-lg shadow-lg bg-white"
            data-testid={`qr-image-${index}`}
          />
        </div>

        {/* URL */}
        <div className="space-y-1">
          <div className="text-xs text-zinc-500">掃描或複製網址：</div>
          <code className="text-xs md:text-sm bg-white/80 px-3 py-2 rounded inline-block break-all">
            {card.fullUrl}
          </code>
        </div>

        {/* 元件 ID */}
        <div className="pt-4 text-xs text-zinc-400">
          pageType: <code>{card.pageType}</code>
        </div>
      </div>
    </div>
  );
}
