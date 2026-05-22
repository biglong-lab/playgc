// 🖨️ Admin — 場域所有任務點的 QR + 代碼列印頁
//
// 用瀏覽器 window.print() 列印（不需後端產 PDF）
// 每張 A4 4 個任務點，含 QR + 代碼 + 名稱 + 描述
// 2026-05-22

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface PrintItem {
  id: number;
  name: string;
  description: string | null;
  verificationMode: string;
  verificationCode: string | null;
  qrToken: string | null;
  qrDataUrl: string | null;
  radius: number | null;
  points: number | null;
  orderIndex: number | null;
}

export default function LocationPrintSheet() {
  const { gameId } = useParams<{ gameId: string }>();
  const [isPrinting, setIsPrinting] = useState(false);

  const { data, isLoading, error } = useQuery<{ gameId: string; items: PrintItem[] }>({
    queryKey: ["/api/games", gameId, "locations/print-data"],
    queryFn: async () => {
      const res = await fetch(`/api/games/${gameId}/locations/print-data`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!gameId,
  });

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  useEffect(() => {
    // 列印模式樣式注入
    const style = document.createElement("style");
    style.id = "print-locations-style";
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
        .print-card {
          page-break-inside: avoid;
          border: 2px dashed #333 !important;
          break-inside: avoid;
        }
        @page { size: A4; margin: 1cm; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("print-locations-style");
      if (el) el.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p>載入失敗</p>
      </div>
    );
  }

  const printableItems = data.items.filter(
    (item) => item.qrDataUrl || item.verificationCode,
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 控制列（列印時隱藏）*/}
      <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/games/${gameId}/locations`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">任務點 QR / 代碼列印</h1>
            <p className="text-xs text-muted-foreground">
              共 {data.items.length} 個任務點，可列印 {printableItems.length} 個
            </p>
          </div>
        </div>
        <Button onClick={handlePrint} disabled={isPrinting} data-testid="button-print-all">
          <Printer className="w-4 h-4 mr-2" />
          列印
        </Button>
      </div>

      {/* 列印區域 */}
      <div id="print-area" className="max-w-[210mm] mx-auto p-6 space-y-4">
        {/* 標題（只列印時顯示）*/}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold">任務點驗證資訊</h1>
          <p className="text-sm text-muted-foreground mt-1">
            列印日期：{new Date().toLocaleDateString("zh-TW")}
          </p>
        </div>

        {printableItems.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
            <p>沒有可列印的任務點</p>
            <p className="text-xs mt-2">請先到 LocationEditor 為任務點啟用 QR 或設定代碼</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
            {printableItems.map((item, idx) => (
              <Card
                key={item.id}
                className="print-card p-4 break-inside-avoid"
                data-testid={`print-card-${item.id}`}
              >
                <div className="text-center space-y-3">
                  {/* 編號 + 名稱 */}
                  <div>
                    <div className="text-xs text-muted-foreground">
                      任務點 #{item.orderIndex ?? idx + 1}
                    </div>
                    <h2 className="text-xl font-bold mt-1">{item.name}</h2>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* QR Code */}
                  {item.qrDataUrl && (
                    <div className="flex justify-center">
                      <img
                        src={item.qrDataUrl}
                        alt={`QR ${item.name}`}
                        className="w-48 h-48"
                      />
                    </div>
                  )}

                  {/* 代碼 */}
                  {item.verificationCode && (
                    <div className="border-2 border-dashed border-primary/40 rounded-md py-3 px-4">
                      <div className="text-xs text-muted-foreground mb-1">驗證代碼</div>
                      <div className="text-4xl font-bold font-mono tracking-widest text-primary">
                        {item.verificationCode}
                      </div>
                    </div>
                  )}

                  {/* 提示 */}
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    {item.qrDataUrl && item.verificationCode
                      ? "掃描 QR 或輸入代碼"
                      : item.qrDataUrl
                        ? "掃描此 QR Code"
                        : "在 app 中輸入此代碼"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 列印頁尾 */}
        <div className="hidden print:block text-xs text-center text-muted-foreground mt-6 pt-3 border-t">
          ✂️ 沿虛線剪下後張貼於任務點現場
        </div>
      </div>
    </div>
  );
}
