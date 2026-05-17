// 🎯 活動列表頁（2026-05-18）
//
// 路徑：/book/:fieldCode
// 業主場域內所有啟用中活動的卡片 grid、玩家點卡片進入該活動的預約頁

import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, MapPin, Activity as ActivityIcon, AlertCircle, Flame } from "lucide-react";

interface Activity {
  id: string;
  slug: string;
  name: string;
  shortDesc?: string | null;
  coverUrl?: string | null;
  locationNote?: string | null;
  priceCents: number;
  currency: string;
  durationMinutes: number;
  capacityPerSlot: number;
  paymentMode: "online" | "onsite" | "both";
  recentBookingCount?: number;
}

interface FieldInfo {
  id: string;
  code: string;
  name: string;
}

interface ActivitiesResponse {
  field: FieldInfo;
  activities: Activity[];
}

export default function BookActivitiesPage() {
  const params = useParams<{ fieldCode: string }>();
  const fieldCode = params.fieldCode ?? "";
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<ActivitiesResponse>({
    queryKey: ["public-activities", fieldCode],
    queryFn: async () => {
      const res = await fetch(`/api/fields/${encodeURIComponent(fieldCode)}/activities`);
      if (!res.ok) throw new Error("查詢失敗");
      return await res.json();
    },
    enabled: !!fieldCode,
  });

  if (isLoading) {
    // 🆕 Skeleton loading：3 張卡片骨架
    return (
      <div className="container-player py-4 pb-24 space-y-4" role="status">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          <div className="h-3 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <div className="w-full h-40 bg-muted animate-pulse" />
              <CardContent className="p-4 space-y-2">
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="flex items-center justify-between pt-2">
                  <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-player py-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 mx-auto text-destructive" aria-hidden="true" />
        <p className="font-semibold">無法載入活動</p>
        <Button onClick={() => window.location.reload()}>重試</Button>
      </div>
    );
  }

  return (
    <div className="container-player py-4 pb-24 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{data?.field.name ?? fieldCode}</h1>
        <p className="text-sm text-muted-foreground">選擇您想參加的活動</p>
      </header>

      {data?.activities?.length === 0 && (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground space-y-3">
            <ActivityIcon className="w-12 h-12 mx-auto opacity-40" aria-hidden="true" />
            <div>
              <p className="font-medium">此場域尚未開放活動預約</p>
              <p className="text-xs mt-1">請洽現場工作人員、或稍後再試</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data?.activities?.map((a) => (
          <Card
            key={a.id}
            className="overflow-hidden cursor-pointer hover-elevate active-elevate-2 transition-shadow"
            onClick={() => navigate(`/book/${fieldCode}/activity/${a.slug}`)}
            data-testid={`card-activity-${a.slug}`}
          >
            {a.coverUrl ? (
              <img
                src={a.coverUrl}
                alt={a.name}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-40 bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
                <ActivityIcon className="w-12 h-12 text-primary/60" aria-hidden="true" />
              </div>
            )}
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-base">{a.name}</h3>
              {a.shortDesc && (
                <p className="text-xs text-muted-foreground line-clamp-2">{a.shortDesc}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {a.durationMinutes} 分
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  {a.capacityPerSlot} 人/梯
                </span>
                {a.locationNote && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    {a.locationNote}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-lg font-bold text-primary">
                    NT${(a.priceCents / 100).toFixed(0)}
                  </span>
                  {a.priceCents > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">📱 現場付款</p>
                  )}
                </div>
                <Button size="sm">立即預約</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
