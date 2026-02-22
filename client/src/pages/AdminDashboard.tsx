// 管理儀表板 — 統一使用 UnifiedAdminLayout
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { Game, GameSession, ArduinoDevice } from "@shared/schema";
import { Gamepad2, Plus, Cpu, Activity, Trophy, Zap } from "lucide-react";

export default function AdminDashboard() {
  const { isAuthenticated } = useAdminAuth();

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  const { data: sessions } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
  });

  const { data: devices } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/devices"],
    enabled: isAuthenticated,
  });

  const activeSessions = sessions?.filter(s => s.status === "playing").length || 0;
  const onlineDevices = devices?.filter(d => d.status === "online").length || 0;
  const publishedGames = games?.filter(g => g.status === "published").length || 0;

  const actions = (
    <Link href="/admin/games/new">
      <Button className="gap-2" data-testid="button-new-game">
        <Plus className="w-4 h-4" />
        新增遊戲
      </Button>
    </Link>
  );

  return (
    <UnifiedAdminLayout title="管理儀表板" actions={actions}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">發布遊戲</CardTitle>
            <Gamepad2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-primary">
              {publishedGames}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {games?.length || 0} 個遊戲
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中場次</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-success">
              {activeSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              目前有玩家進行中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在線設備</CardTitle>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-warning">
              {onlineDevices}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {devices?.length || 0} 台設備
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日完成</CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold">
              {sessions?.filter(s => s.status === "completed").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              場遊戲完成
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              最近遊戲
              <Link href="/admin/games">
                <Button variant="ghost" size="sm">查看全部</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {games && games.length > 0 ? (
              <div className="space-y-3">
                {games.slice(0, 5).map((game) => (
                  <Link
                    key={game.id}
                    href={`/admin/games/${game.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover-elevate cursor-pointer"
                    data-testid={`link-game-${game.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <Gamepad2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{game.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.estimatedTime || 30} 分鐘
                        </p>
                      </div>
                    </div>
                    <Badge variant={game.status === "published" ? "default" : "secondary"}>
                      {game.status === "published" ? "已發布" : "草稿"}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>尚無遊戲</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              設備狀態
              <Link href="/admin/devices">
                <Button variant="ghost" size="sm">查看全部</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.slice(0, 5).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center ${
                        device.status === "online"
                          ? "bg-success/10"
                          : "bg-muted"
                      }`}>
                        <Cpu className={`w-5 h-5 ${
                          device.status === "online"
                            ? "text-success"
                            : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{device.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.deviceType || "未知類型"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={device.status === "online" ? "default" : "secondary"}
                      className={device.status === "online" ? "bg-success" : ""}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      {device.status === "online" ? "在線" : "離線"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>尚無設備</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}
