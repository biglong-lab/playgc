// 玩家通知 inbox — 顯示 in_app channel 的通知紀錄
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §16
//
// 來源：notification_events 表 channelType=in_app 的紀錄
//
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeAgo } from "@/lib/battle-time";
import { Bell, Sparkles, Trophy, Gift, Swords, AlertCircle } from "lucide-react";

interface InboxEvent {
  id: string;
  fieldId?: string | null;
  squadId?: string | null;
  eventType: string;
  channelType: string;
  status: string;
  payload: {
    title?: string;
    body?: string;
    deepLink?: string;
    imageUrl?: string;
  };
  sentAt?: string | null;
  createdAt: string;
}

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  first_game: Sparkles,
  rank_change: Trophy,
  reward_issued: Gift,
  tier_upgrade: Trophy,
  dormancy_warning: AlertCircle,
  super_leader_promoted: Trophy,
  welcome_squad_assigned: Swords,
};

const EVENT_LABEL: Record<string, string> = {
  first_game: "上榜啦",
  rank_change: "排名變動",
  reward_issued: "獎勵發放",
  tier_upgrade: "段位升級",
  dormancy_warning: "回流提醒",
  super_leader_promoted: "超級隊長",
  welcome_squad_assigned: "歡迎隊伍",
};

export default function MyInbox() {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery<InboxEvent[]>({
    queryKey: ["/api/me/inbox"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/inbox?limit=50");
      return res.json();
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-3">請先登入查看通知</p>
            <Link href="/">
              <Button>返回首頁登入</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          <p className="text-sm text-muted-foreground">
            隊伍動態、獎勵發放、回流提醒
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="bg-card border-dashed">
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-2">目前沒有通知</p>
            <p className="text-xs text-muted-foreground mb-4">
              玩遊戲、獲得獎勵、隊伍升級等動態會出現在這裡
            </p>
            <Link href="/battle">
              <Button className="gap-2">
                <Swords className="h-4 w-4" />
                前往對戰中心
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = EVENT_ICON[event.eventType] ?? Bell;
            const label = EVENT_LABEL[event.eventType] ?? event.eventType;
            const time = event.sentAt ?? event.createdAt;

            const content = (
              <Card className="bg-card hover:bg-card/80 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">
                          {event.payload.title ?? label}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">
                          {label}
                        </Badge>
                      </div>
                      {event.payload.body && (
                        <p className="text-sm text-muted-foreground">
                          {event.payload.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatTimeAgo(new Date(time))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // 有 deepLink 就包 Link
            if (event.payload.deepLink) {
              return (
                <Link key={event.id} href={event.payload.deepLink}>
                  {content}
                </Link>
              );
            }
            return <div key={event.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
