// 票券/收款統計總覽頁面
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, TrendingUp, Ticket, ExternalLink, QrCode } from "lucide-react";

interface GameTicketStats {
  gameId: string;
  title: string;
  revenue: number;
  purchaseCount: number;
  totalCodes: number;
  activeCodes: number;
  usedCount: number;
}

interface TicketsSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  games: GameTicketStats[];
}

export default function TicketsOverview() {
  const { data, isLoading } = useQuery<TicketsSummary>({
    queryKey: ["/api/admin/tickets/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/tickets/summary");
      return res.json();
    },
  });

  return (
    <AdminLayout title="票券/收款管理">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* 頂部統計 */}
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              title="總收入"
              value={formatCurrency(data?.totalRevenue ?? 0)}
              icon={<DollarSign className="w-5 h-5" />}
              color="text-green-600"
            />
            <SummaryCard
              title="本月收入"
              value={formatCurrency(data?.monthlyRevenue ?? 0)}
              icon={<TrendingUp className="w-5 h-5" />}
              color="text-blue-600"
            />
            <SummaryCard
              title="遊戲數"
              value={String(data?.games?.length ?? 0)}
              icon={<Ticket className="w-5 h-5" />}
              color="text-purple-600"
            />
          </div>

          {/* 各遊戲統計 */}
          <Card>
            <CardHeader>
              <CardTitle>各遊戲收款明細</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.games?.length ? (
                <p className="text-muted-foreground text-center py-8">
                  尚無遊戲資料
                </p>
              ) : (
                <div className="space-y-3">
                  {data.games.map((game) => (
                    <GameStatsRow key={game.gameId} game={game} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function SummaryCard({
  title, value, icon, color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-number mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-full bg-muted ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameStatsRow({ game }: { game: GameTicketStats }) {
  // 判斷使用 admin 或 admin-staff 路徑
  const basePath = window.location.pathname.startsWith("/admin-staff")
    ? "/admin-staff" : "/admin";

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{game.title}</p>
        <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
          <span className="font-number">{formatCurrency(game.revenue)}</span>
          <span>·</span>
          <span>{game.purchaseCount} 筆購買</span>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <div className="text-right">
          <div className="flex items-center gap-1 text-sm">
            <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-number">{game.activeCodes}/{game.totalCodes}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            已使用 {game.usedCount}
          </p>
        </div>
        <Link href={`${basePath}/games/${game.gameId}/tickets`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> 詳細
          </Button>
        </Link>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}
