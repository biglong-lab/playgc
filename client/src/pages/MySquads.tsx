// 🛡 MySquads — 我的隊伍列表（PR1 of Squad 系統一次到位）
//
// 路徑：/me/squads
// 用途：使用者一次看到自己參與的所有 Squad（含隊長 / 隊員角色）
// API：GET /api/me/squads
//
// 設計依據：docs/SQUAD_SYSTEM_DESIGN.md §20

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield, Plus, Crown, ChevronRight, Loader2 } from "lucide-react";

interface MySquad {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  primaryColor: string | null;
  status: string;
  myRole: "leader" | "officer" | "member";
  joinedAt: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  leader: { label: "隊長", icon: Crown, color: "text-yellow-500" },
  officer: { label: "幹部", icon: Shield, color: "text-blue-500" },
  member: { label: "隊員", icon: Shield, color: "text-muted-foreground" },
};

export default function MySquads() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{ memberships: MySquad[] }>({
    queryKey: ["/api/me/squads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/squads");
      return res.json();
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-sm">請先登入才能查看你的隊伍</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              回首頁登入
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberships = data?.memberships ?? [];
  const activeSquads = memberships.filter((m) => m.status === "active");

  return (
    <div className="min-h-screen bg-background pb-bottom-nav md:pb-0">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              data-testid="btn-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display font-bold text-lg">我的隊伍</h1>
          </div>
          <Link href="/squad/create">
            <Button size="sm" data-testid="btn-create-squad-header">
              <Plus className="w-4 h-4 mr-1" />
              建立
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {isLoading && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              載入中...
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="p-6 text-center text-destructive">
              載入失敗，請重試
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && activeSquads.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-semibold mb-1">還沒加入任何隊伍</h2>
                <p className="text-sm text-muted-foreground">
                  建立隊伍累積跨遊戲戰績，或透過邀請連結加入朋友的隊伍
                </p>
              </div>
              <Link href="/squad/create">
                <Button size="lg" className="w-full" data-testid="btn-create-squad-empty">
                  <Plus className="w-4 h-4 mr-2" />
                  建立第一支隊伍
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {activeSquads.length > 0 && (
          <div className="space-y-3">
            {activeSquads.map((squad) => {
              const roleMeta = ROLE_LABELS[squad.myRole] ?? ROLE_LABELS.member;
              const RoleIcon = roleMeta.icon;
              const color = squad.primaryColor || "#f97316";
              return (
                <Link key={squad.id} href={`/squad/${squad.id}`}>
                  <Card
                    className="hover:border-primary/40 cursor-pointer active:scale-[0.98] transition-all"
                    data-testid={`card-squad-${squad.id}`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{ backgroundColor: `${color}25`, color }}
                      >
                        [{squad.tag}]
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{squad.name}</h3>
                          <Badge variant="outline" className={`text-[10px] gap-0.5 ${roleMeta.color}`}>
                            <RoleIcon className="w-3 h-3" />
                            {roleMeta.label}
                          </Badge>
                        </div>
                        {squad.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {squad.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* 說明卡 */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p>💡 一個玩家可以加入多個隊伍，但只能擔任一個隊伍的隊長</p>
            <p>🏆 隊伍戰績跨遊戲累積（一般冒險、水彈對戰、競賽接力都算）</p>
            <p>🔗 透過邀請連結加入隊伍，不需要場域限制</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
