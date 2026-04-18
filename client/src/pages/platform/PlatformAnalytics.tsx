// 🌐 平台跨場域分析（Phase A-1.3）
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, Building2, Gamepad2, ShoppingBag, Swords, DollarSign } from "lucide-react";

interface FieldStat {
  field_id: string;
  field_code: string;
  field_name: string;
  plan_code: string | null;
  games_count: number;
  checkouts_this_month: number;
  battle_slots_this_month: number;
  platform_fees_this_month: number;
  created_at: string;
}

interface AnalyticsData {
  fields: FieldStat[];
  summary: {
    fieldsCount: number;
    monthlyTotalFees: number;
    monthlyPendingFees: number;
  };
}

export default function PlatformAnalytics() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/platform/analytics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/analytics");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="📊 跨場域數據分析">
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            跨場域即時監控
          </h2>
          <p className="text-indigo-50 text-sm">
            比較所有場域的遊戲數、本月結帳量、對戰時段、平台費用
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 總覽 */}
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                icon={<Building2 className="w-5 h-5 text-indigo-600" />}
                label="場域總數"
                value={data?.summary.fieldsCount ?? 0}
              />
              <StatCard
                icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
                label="本月已收平台費"
                value={`NT$ ${(data?.summary.monthlyTotalFees ?? 0).toLocaleString("zh-TW")}`}
              />
              <StatCard
                icon={<DollarSign className="w-5 h-5 text-amber-600" />}
                label="本月待收平台費"
                value={`NT$ ${(data?.summary.monthlyPendingFees ?? 0).toLocaleString("zh-TW")}`}
              />
            </div>

            {/* 場域排行 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🏢 場域排行（按本月平台費）</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data?.fields?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">尚無場域</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/30">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">場域</th>
                          <th className="text-left py-2 px-2 font-medium text-xs text-muted-foreground">方案</th>
                          <th className="text-right py-2 px-2 font-medium text-xs text-muted-foreground">
                            <Gamepad2 className="w-3 h-3 inline mr-1" />遊戲
                          </th>
                          <th className="text-right py-2 px-2 font-medium text-xs text-muted-foreground">
                            <ShoppingBag className="w-3 h-3 inline mr-1" />本月結帳
                          </th>
                          <th className="text-right py-2 px-2 font-medium text-xs text-muted-foreground">
                            <Swords className="w-3 h-3 inline mr-1" />本月對戰
                          </th>
                          <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">本月平台費</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.fields.map((f) => (
                          <tr key={f.field_id} className="border-b hover:bg-muted/20">
                            <td className="py-2 px-3">
                              <div className="font-medium">{f.field_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{f.field_code}</div>
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {f.plan_code ?? "—"}
                              </Badge>
                            </td>
                            <td className="text-right py-2 px-2 font-number">{f.games_count}</td>
                            <td className="text-right py-2 px-2 font-number">{f.checkouts_this_month}</td>
                            <td className="text-right py-2 px-2 font-number">{f.battle_slots_this_month}</td>
                            <td className="text-right py-2 px-3 font-number font-medium">
                              NT$ {f.platform_fees_this_month.toLocaleString("zh-TW")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-2">{icon}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-number mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
