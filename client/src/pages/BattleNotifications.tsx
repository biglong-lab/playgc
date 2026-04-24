// 水彈對戰 PK 擂台 — 通知中心頁面（深色軍事風格）
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
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
        {/* 全部已讀按鈕 */}
        {unreadCount > 0 && (
          <div className="flex items-center justify-between">
            <Badge variant="outline">{unreadCount} 則未讀</Badge>
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
              <p>目前沒有通知</p>
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

  const timeAgo = getTimeAgo(new Date(notification.createdAt));

  const inner = (
    <Card
      className={`bg-card border-border transition-colors ${
        notification.isRead ? "opacity-60" : "border-primary/30"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={notification.isRead ? "outline" : "default"} className="text-xs">
                {typeLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            <h3 className="font-medium text-sm">{content.title}</h3>
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
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (content.actionUrl) {
    return <Link href={content.actionUrl}>{inner}</Link>;
  }
  return inner;
}

/** 時間距離（簡易版） */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "剛剛";
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return `${Math.floor(diffDay / 30)} 個月前`;
}
