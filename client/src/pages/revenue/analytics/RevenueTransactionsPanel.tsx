// 📊 營收明細下鑽 — 跨源交易表 + CSV 匯出
//
// 匯出一律沿用「當前篩選條件」，不是整張表倒出來，避免使用者以為
// 匯出的是全部資料。金額欄位輸出「元」，方便直接進 Excel 試算。
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv, formatCsvDateTime, type CsvColumn } from "@/lib/csv-export";
import {
  money, useRevenueTransactions,
  type DateRange, type RevenueSource, type UnifiedTransaction,
} from "./useRevenueAnalytics";

const SOURCE_LABEL: Record<RevenueSource, string> = {
  pos: "現場收款",
  game: "遊戲購買",
  battle: "對戰報名",
};

type Filter = "all" | RevenueSource;

interface Props {
  range: DateRange;
  enabled: boolean;
}

export default function RevenueTransactionsPanel({ range, enabled }: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const sources: RevenueSource[] = filter === "all" ? [] : [filter];
  const { data, isLoading } = useRevenueTransactions(range, sources, enabled);

  const rows = data?.transactions ?? [];

  const handleExport = () => {
    const columns: CsvColumn<UnifiedTransaction>[] = [
      { header: "營業日", get: (t) => t.businessDate },
      { header: "時間", get: (t) => formatCsvDateTime(t.occurredAt) },
      { header: "來源", get: (t) => SOURCE_LABEL[t.source] },
      { header: "項目", get: (t) => t.label },
      { header: "明細", get: (t) => t.detail ?? "" },
      { header: "金額 (NT$)", get: (t) => Math.round(t.amountCents / 100) },
      { header: "狀態 / 付款方式", get: (t) => t.status },
      { header: "交易 ID", get: (t) => t.id },
    ];
    exportToCsv(columns, rows, `revenue-${range.from}_${range.to}`);
    toast({
      title: "✅ 已開始下載",
      description: `${range.from} ~ ${range.to}，共 ${rows.length} 筆`,
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">交易明細</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!rows.length}
            onClick={handleExport}
            data-testid="btn-export-revenue-csv"
          >
            <Download className="w-4 h-4" />
            匯出 CSV
          </Button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tx-all">全部</TabsTrigger>
              <TabsTrigger value="pos" data-testid="tx-pos">現場</TabsTrigger>
              <TabsTrigger value="game" data-testid="tx-game">遊戲</TabsTrigger>
              <TabsTrigger value="battle" data-testid="tx-battle">對戰</TabsTrigger>
            </TabsList>
          </Tabs>
          {data?.truncated && (
            <Badge variant="secondary" className="text-[10px]">
              僅顯示最新 {rows.length} 筆，請縮小區間查看完整資料
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            載入中…
          </div>
        ) : rows.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Receipt className="w-8 h-8" aria-hidden />
            <p className="text-sm">此區間沒有交易紀錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[28rem]" data-testid="tx-table">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">營業日</th>
                  <th className="text-left py-2 px-3 font-medium">來源</th>
                  <th className="text-left py-2 px-3 font-medium">項目</th>
                  <th className="text-left py-2 px-3 font-medium">明細</th>
                  <th className="text-right py-2 pl-3 font-medium whitespace-nowrap">金額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap font-number tabular-nums">
                      {t.businessDate.slice(5)}
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {SOURCE_LABEL[t.source]}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3">{t.label}</td>
                    <td className="py-1.5 px-3 text-muted-foreground text-xs max-w-[18rem] truncate">
                      {t.detail ?? "—"}
                    </td>
                    <td className="py-1.5 pl-3 text-right font-number tabular-nums whitespace-nowrap">
                      {money(t.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
