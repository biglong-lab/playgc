// 📊 PWA 使用情境分析頁
//
// 解決使用者要求「後台統計交叉分析使用情境，作為未來優化參考」
//
// 三組統計：
//   1. 啟動模式分布（standalone / browser / twa）
//   2. QR 掃描來源占比（in_pwa_scan / browser_camera / manual_input）
//   3. 每日啟動趨勢（折線圖）
//
// 設計依據：docs/PWA_USER_FLOW_OPTIMIZATION_V2.md Phase D

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  Smartphone,
  Globe,
  QrCode,
  TrendingUp,
  Camera,
  Type as TypeIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PwaUsageStats {
  since: string;
  days: number;
  launchByMode: Array<{ code: string; count: number }>;
  qrScansBySource: Array<{ code: string; count: number }>;
  launchTrendDaily: Array<{ day: string; count: number }>;
}

const MODE_LABELS: Record<string, { label: string; color: string; icon: typeof Smartphone }> = {
  app_launch_standalone: { label: "PWA standalone", color: "bg-emerald-500", icon: Smartphone },
  app_launch_browser: { label: "瀏覽器", color: "bg-blue-500", icon: Globe },
  app_launch_twa: { label: "TWA (Android)", color: "bg-purple-500", icon: Smartphone },
};

const QR_SOURCE_LABELS: Record<string, { label: string; color: string; icon: typeof QrCode }> = {
  qr_scan_in_pwa_scan: { label: "PWA 內掃描", color: "bg-emerald-500", icon: QrCode },
  qr_scan_browser_camera: { label: "瀏覽器掃描", color: "bg-blue-500", icon: Camera },
  qr_scan_manual_input: { label: "手動輸入", color: "bg-yellow-500", icon: TypeIcon },
};

export default function PwaUsageAnalytics() {
  const { admin } = useAdminAuth({ redirectTo: "/admin/login" });
  const [days, setDays] = useState(7);

  const { data, isLoading, error } = useQuery<PwaUsageStats>({
    queryKey: [`/api/admin/analytics/pwa-usage?days=${days}`],
    enabled: !!admin,
  });

  // 計算總和 + 比例
  const launchTotal =
    data?.launchByMode.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const qrTotal =
    data?.qrScansBySource.reduce((sum, r) => sum + r.count, 0) ?? 0;

  // PWA 比例（standalone + twa） / 總啟動
  const pwaCount =
    (data?.launchByMode.find((r) => r.code === "app_launch_standalone")?.count ?? 0) +
    (data?.launchByMode.find((r) => r.code === "app_launch_twa")?.count ?? 0);
  const pwaRatio = launchTotal > 0 ? Math.round((pwaCount * 100) / launchTotal) : 0;

  // PWA 內 QR 掃描比例
  const inPwaScans =
    data?.qrScansBySource.find((r) => r.code === "qr_scan_in_pwa_scan")?.count ?? 0;
  const inPwaQrRatio = qrTotal > 0 ? Math.round((inPwaScans * 100) / qrTotal) : 0;

  return (
    <UnifiedAdminLayout title="PWA 使用情境分析">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          統計使用者進入 App 的方式與 QR 掃描來源（資料來源 client_events，自動 7 天清理）
        </p>
        {/* 期間切換 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">期間：</span>
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
              data-testid={`btn-days-${d}`}
            >
              {d === 1 ? "24 小時" : `${d} 天`}
            </Button>
          ))}
        </div>

        {isLoading && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              載入中...
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="p-6 text-center text-destructive">
              查詢失敗，請稍後再試
            </CardContent>
          </Card>
        )}

        {data && !isLoading && (
          <>
            {/* 摘要卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-total-launches">
                <CardHeader className="pb-2">
                  <CardDescription>App 啟動總次數</CardDescription>
                  <CardTitle className="text-3xl font-number">{launchTotal}</CardTitle>
                </CardHeader>
              </Card>
              <Card data-testid="card-pwa-ratio">
                <CardHeader className="pb-2">
                  <CardDescription>PWA 使用率</CardDescription>
                  <CardTitle className="text-3xl font-number flex items-baseline gap-1">
                    {pwaRatio}<span className="text-lg">%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {pwaCount} / {launchTotal} 次走 PWA standalone 模式
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="card-pwa-qr-ratio">
                <CardHeader className="pb-2">
                  <CardDescription>PWA 內 QR 掃描占比</CardDescription>
                  <CardTitle className="text-3xl font-number flex items-baseline gap-1">
                    {inPwaQrRatio}<span className="text-lg">%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {inPwaScans} / {qrTotal} 次掃描來自 PWA 內
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 啟動模式分布 */}
            <Card data-testid="card-launch-by-mode">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" /> 啟動模式分布
                </CardTitle>
                <CardDescription>各種模式啟動 App 的次數</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.launchByMode.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">尚無數據</p>
                ) : (
                  data.launchByMode.map((row) => {
                    const meta = MODE_LABELS[row.code] || {
                      label: row.code,
                      color: "bg-gray-500",
                      icon: Smartphone,
                    };
                    const ratio = launchTotal > 0 ? (row.count * 100) / launchTotal : 0;
                    const Icon = meta.icon;
                    return (
                      <div key={row.code} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{meta.label}</span>
                          </span>
                          <span className="font-number">
                            {row.count} <span className="text-xs text-muted-foreground">({Math.round(ratio)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${meta.color}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* QR 掃描來源 */}
            <Card data-testid="card-qr-source">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" /> QR 掃描來源
                </CardTitle>
                <CardDescription>玩家在哪裡掃描遊戲 QR Code</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.qrScansBySource.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">尚無數據</p>
                ) : (
                  data.qrScansBySource.map((row) => {
                    const meta = QR_SOURCE_LABELS[row.code] || {
                      label: row.code,
                      color: "bg-gray-500",
                      icon: QrCode,
                    };
                    const ratio = qrTotal > 0 ? (row.count * 100) / qrTotal : 0;
                    const Icon = meta.icon;
                    return (
                      <div key={row.code} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{meta.label}</span>
                          </span>
                          <span className="font-number">
                            {row.count} <span className="text-xs text-muted-foreground">({Math.round(ratio)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${meta.color}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                <p className="text-xs text-muted-foreground italic mt-2">
                  💡 PWA 內掃描比例越高代表玩家養成「在 App 內掃 QR」習慣
                </p>
              </CardContent>
            </Card>

            {/* 趨勢線 */}
            <Card data-testid="card-trend">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> 每日啟動趨勢
                </CardTitle>
                <CardDescription>近 {days} 天每日 App 啟動次數</CardDescription>
              </CardHeader>
              <CardContent>
                {data.launchTrendDaily.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">尚無數據</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={data.launchTrendDaily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#10b981"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* 數據說明 */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6 space-y-2 text-xs text-muted-foreground">
                <p>
                  <Badge variant="outline" className="mr-1">資料來源</Badge>
                  client_events 表（自動 7 天清理）
                </p>
                <p>
                  <Badge variant="outline" className="mr-1">採集時機</Badge>
                  App 啟動 1 秒後 + QR 掃描成功時
                </p>
                <p>
                  <Badge variant="outline" className="mr-1">應用方向</Badge>
                  PWA 比例低 → 加強 install prompt；PWA 內 QR 比例低 → 玩家可能不知道 PWA 內可掃
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}
