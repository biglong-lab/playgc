// 水彈對戰 PK 擂台 — 玩家端首頁（深色軍事風格）
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import BattleLayout from "@/components/battle/BattleLayout";
import { slotStatusBadge } from "@/lib/battle-labels";
import { formatTimeUntil } from "@/lib/battle-time";
import { apiRequest } from "@/lib/queryClient";
import type { BattleVenue, BattleSlot } from "@shared/schema";
import { Swords, Clock, Users, MapPin, CalendarDays, ChevronRight, Trophy, Shield, History, User, Bell, Medal, LogIn } from "lucide-react";

export default function BattleHome() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: venues = [], isLoading: venuesLoading } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues", { fieldId: fieldId ?? "all" }],
    queryFn: async () => {
      const url = fieldId
        ? `/api/battle/venues?fieldId=${fieldId}`
        : `/api/battle/venues`;
      try {
        const res = await apiRequest("GET", url);
        return res.json();
      } catch {
        return [];
      }
    },
  });

  return (
    <BattleLayout title="水彈對戰 PK 擂台" subtitle="選擇場地和時段，與其他玩家組隊對戰！" backHref="/home">
      <div className="space-y-6">
        {/* 未登入提示 */}
        {!user && <LoginPromptCard />}

        {/* 我的報名 */}
        {user && <MyRegistrations />}

        {/* 場地列表 */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            對戰場地
          </h2>

          {venuesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i} className="bg-card border-border">
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                目前沒有可用的對戰場地
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </div>

        {/* 底部導航 */}
        {user && <QuickNav />}
      </div>
    </BattleLayout>
  );
}

/** 快速導航六格 */
function QuickNav() {
  const navItems = [
    { href: "/battle/my", icon: User, label: "我的檔案", color: "text-primary" },
    { href: "/battle/ranking", icon: Trophy, label: "排行榜", color: "text-tactical-orange" },
    { href: "/battle/clan/create", icon: Shield, label: "戰隊", color: "text-purple-400" },
    { href: "/battle/notifications", icon: Bell, label: "通知", color: "text-orange-400" },
    { href: "/battle/achievements", icon: Medal, label: "成就", color: "text-amber-400" },
    { href: "/battle/history", icon: History, label: "歷史", color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {navItems.map(({ href, icon: Icon, label, color }) => (
        <Link key={href} href={href}>
          <Card className="bg-card/50 border-border hover:bg-card cursor-pointer transition-colors">
            <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-xs font-medium">{label}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** 登入提示卡片 */
function LoginPromptCard() {
  const [showLogin, setShowLogin] = useState(false);
  const handlers = useLoginHandlers(() => setShowLogin(false), { redirectTo: null });

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6 text-center space-y-3">
          <LogIn className="h-8 w-8 mx-auto text-primary" />
          <div>
            <p className="font-medium">登入以解鎖完整功能</p>
            <p className="text-sm text-muted-foreground mt-1">
              報名對戰、查看排行榜、組建戰隊
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowLogin(true)}>
            <LogIn className="h-4 w-4" />
            立即登入
          </Button>
        </CardContent>
      </Card>
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={handlers}
      />
    </>
  );
}

/** 場地卡片 */
function VenueCard({ venue }: { venue: BattleVenue }) {
  const today = new Date().toISOString().split("T")[0];
  const { data: slots = [] } = useQuery<BattleSlot[]>({
    queryKey: ["/api/battle/slots", venue.id],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/battle/slots?venueId=${venue.id}&fromDate=${today}`);
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const openSlots = slots.filter((s) => s.status === "open" || s.status === "confirmed");

  return (
    <Card className="bg-card border-border hover-elevate transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          {venue.name}
          <Badge variant="outline" className="text-xs">{venue.venueType}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {venue.minPlayers}-{venue.maxPlayers} 人
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {venue.gameDurationMinutes} 分鐘
          </span>
        </div>

        {openSlots.length > 0 ? (
          <div className="space-y-2">
            {openSlots.slice(0, 3).map((slot) => (
              <Link key={slot.id} href={`/battle/slot/${slot.id}`}>
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span>{slot.slotDate}</span>
                    <span className="text-muted-foreground">
                      {slot.startTime?.slice(0, 5)}-{slot.endTime?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-number">
                      {slot.currentCount}/{slot.maxPlayersOverride ?? venue.maxPlayers}
                    </span>
                    {slotStatusBadge(slot.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">目前沒有開放的時段</p>
        )}
      </CardContent>
      {openSlots.length > 3 && (
        <CardFooter className="pt-0">
          <Button variant="ghost" size="sm" className="w-full text-xs">
            查看更多時段 ({openSlots.length - 3} 個)
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/** 我的報名紀錄 */
function MyRegistrations() {
  const { user } = useAuth();
  const { data: registrations = [] } = useQuery({
    queryKey: ["/api/battle/my-registrations"],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authFetch");
      const res = await authFetch("/api/battle/my-registrations");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  if (registrations.length === 0) return null;

  // 🔧 排序：未結束的優先，依 slotDate + startTime 由近到遠
  type RegItem = {
    id: string; slotId: string; status: string;
    slotDate?: string; startTime?: string; endTime?: string; venueName?: string;
  };
  const sorted = ([...registrations] as RegItem[]).sort((a, b) => {
    const aKey = `${a.slotDate ?? ""}T${a.startTime ?? "00:00:00"}`;
    const bKey = `${b.slotDate ?? ""}T${b.startTime ?? "00:00:00"}`;
    return aKey.localeCompare(bKey);
  });
  const upcoming = sorted.filter((r) => {
    if (!r.slotDate) return false;
    const end = r.endTime ? new Date(`${r.slotDate}T${r.endTime.slice(0, 5)}:00`) : null;
    return !end || end > new Date();
  });
  const nextUp = upcoming[0];
  const nextUpTime = nextUp ? formatTimeUntil(nextUp.slotDate, nextUp.startTime, nextUp.endTime) : "";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          我的報名 ({registrations.length})
          {/* 🚀 下一場 sticky highlight：突出最近一場時間 */}
          {nextUp && nextUpTime && (
            <Badge variant="default" className="ml-auto text-xs animate-pulse">
              下一場：{nextUpTime}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.slice(0, 3).map((reg) => {
            const isNext = reg.id === nextUp?.id;
            const timeLabel = formatTimeUntil(reg.slotDate, reg.startTime, reg.endTime);
            return (
              <Link key={reg.id} href={`/battle/slot/${reg.slotId}`}>
                <div
                  className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm transition-colors ${
                    isNext
                      ? "bg-primary/10 hover:bg-primary/20 ring-1 ring-primary/40"
                      : "bg-card hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {reg.venueName ?? "場地"}
                      {timeLabel && <span className="ml-1 text-muted-foreground">· {timeLabel}</span>}
                    </span>
                  </div>
                  {slotStatusBadge(reg.status)}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
