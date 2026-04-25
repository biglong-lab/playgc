// 水彈對戰 PK 擂台 — 通知中心頁面（深色軍事風格）
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCheck, Swords } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeAgo } from "@/lib/battle-time";
import BattleLayout from "@/components/battle/BattleLayout";
import {
  notificationTypeLabels,
  type BattleNotification,
  type NotificationType,
} from "@shared/schema";

export default function BattleNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<BattleNotification[]>({
    queryKey: ["/api/battle/notifications"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/notifications?limit=50");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/battle/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/battle/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/notifications/unread-count"] });
      toast({ title: "已全部標記為已讀" });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <BattleLayout title="通知中心">
      <div className="space-y-3">
        {/* 全部已讀按鈕（未讀數 用顯眼 default Badge）*/}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-2 -mx-4 px-4 border-b">
            <Badge variant="default" className="text-xs">
              {unreadCount} 則未讀
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              全部已讀
            </Button>
          </div>
        )}

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          ))
        ) : notifications.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2">目前沒有通知</p>
              <p className="text-xs mb-4">
                報名對戰、隊伍邀請、賽季結算等都會通知你
              </p>
              {/* 🚀 Empty state CTA */}
              <Link href="/battle">
                <Button size="sm" className="gap-2">
                  <Swords className="h-4 w-4" />
                  前往對戰中心
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onMarkRead={() => markReadMutation.mutate(notif.id)}
            />
          ))
        )}
      </div>
    </BattleLayout>
  );
}

/** 單則通知卡片 */
function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: BattleNotification;
  onMarkRead: () => void;
}) {
  const content = notification.content as {
    title: string;
    body: string;
    actionUrl?: string;
  };
  const typeLabel =
    notificationTypeLabels[notification.type as NotificationType] ??
    notification.type;

  const timeAgo = formatTimeAgo(new Date(notification.createdAt));

  const inner = (
    <Card
      className={`transition-all relative ${
        notification.isRead
          ? "opacity-60 bg-card border-border hover:opacity-90"
          : "bg-card border-primary/40 shadow-sm hover:shadow-md"
      }`}
    >
      {/* 🔵 未讀左邊小色塊（強烈視覺對比） */}
      {!notification.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l" />
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={notification.isRead ? "outline" : "default"} className="text-xs">
                {typeLabel}
              </Badge>
              {!notification.isRead && (
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            <h3 className={`text-sm ${notification.isRead ? "font-normal" : "font-semibold"}`}>
              {content.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {content.body}
            </p>
          </div>
          {!notification.isRead && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead();
              }}
              title="標記為已讀"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (content.actionUrl) {
    // 🚀 點擊有 actionUrl 的卡片自動標記為已讀（如果是未讀的話）
    return (
      <Link
        href={content.actionUrl}
        onClick={() => {
          if (!notification.isRead) onMarkRead();
        }}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
