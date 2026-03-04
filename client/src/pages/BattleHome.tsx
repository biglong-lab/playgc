// 水彈對戰 PK 擂台 — 玩家端首頁
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { BattleVenue, BattleSlot } from "@shared/schema";
import { Swords, Clock, Users, MapPin, CalendarDays, ChevronRight } from "lucide-react";

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
  const [selectedFieldId] = useState<string | null>(null);

  // 取得所有場地（需要知道 fieldId — 先用 query param 或從使用者取得）
  // 暫時用全域列表，後續可依場域篩選
  const { data: venues = [], isLoading: venuesLoading } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues", { fieldId: selectedFieldId ?? user?.defaultFieldId ?? "" }],
    queryFn: async () => {
      const fieldId = selectedFieldId ?? user?.defaultFieldId;
      if (!fieldId) return [];
      const res = await fetch(`/api/battle/venues?fieldId=${fieldId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(selectedFieldId ?? user?.defaultFieldId),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 標題區 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Swords className="h-8 w-8" />
            <h1 className="text-2xl font-bold">水彈對戰 PK 擂台</h1>
          </div>
          <p className="text-blue-100">選擇場地和時段，與其他玩家組隊對戰！</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 我的報名 */}
        {user && <MyRegistrations />}

        {/* 場地列表 */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            對戰場地
          </h2>

          {venuesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <Card>
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
      </div>
    </div>
  );
}

/** 場地卡片，內含該場地的近期時段 */
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
    <Card className="hover:shadow-md transition-shadow">
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
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span>{slot.slotDate}</span>
                    <span className="text-muted-foreground">
                      {slot.startTime?.slice(0, 5)}-{slot.endTime?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
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
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-blue-600" />
          我的報名 ({registrations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {registrations.slice(0, 3).map((reg: { id: string; slotId: string; status: string }) => (
            <Link key={reg.id} href={`/battle/slot/${reg.slotId}`}>
              <div className="flex items-center justify-between p-2 rounded bg-white hover:bg-gray-50 cursor-pointer text-sm">
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
