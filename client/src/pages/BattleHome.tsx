// 水彈對戰 PK 擂台 — 玩家端首頁（深色軍事風格）
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattleVenue, BattleSlot } from "@shared/schema";
import { Swords, Clock, Users, MapPin, CalendarDays, ChevronRight, Trophy, Shield, History, User, Bell, Medal } from "lucide-react";

/** 時段狀態對應中文 + Badge 樣式 */
function slotStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    open: { label: "開放報名", variant: "default" },
    confirmed: { label: "已成局", variant: "secondary" },
    full: { label: "已額滿", variant: "destructive" },
    in_progress: { label: "對戰中", variant: "outline" },
    completed: { label: "已結束", variant: "outline" },
    cancelled: { label: "已取消", variant: "destructive" },
  };
  const info = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export default function BattleHome() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: venues = [], isLoading: venuesLoading } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues", { fieldId: fieldId ?? "all" }],
    queryFn: async () => {
      const url = fieldId
        ? `/api/battle/venues?fieldId=${fieldId}`
        : `/api/battle/venues`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <BattleLayout title="水彈對戰 PK 擂台" subtitle="選擇場地和時段，與其他玩家組隊對戰！" backHref="/home">
      <div className="space-y-6">
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

/** 場地卡片 */
function VenueCard({ venue }: { venue: BattleVenue }) {
  const today = new Date().toISOString().split("T")[0];
  const { data: slots = [] } = useQuery<BattleSlot[]>({
    queryKey: ["/api/battle/slots", venue.id],
    queryFn: async () => {
      const res = await fetch(`/api/battle/slots?venueId=${venue.id}&fromDate=${today}`);
      if (!res.ok) return [];
      return res.json();
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
  const { data: registrations = [] } = useQuery({
    queryKey: ["/api/battle/my-registrations"],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch("/api/battle/my-registrations", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (registrations.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          我的報名 ({registrations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {registrations.slice(0, 3).map((reg: { id: string; slotId: string; status: string }) => (
            <Link key={reg.id} href={`/battle/slot/${reg.slotId}`}>
              <div className="flex items-center justify-between p-2 rounded bg-card hover:bg-card/80 cursor-pointer text-sm transition-colors">
                <span>時段 {reg.slotId.slice(0, 8)}...</span>
                {slotStatusBadge(reg.status)}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
