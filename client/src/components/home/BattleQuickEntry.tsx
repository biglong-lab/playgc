// ⚔️ 大廳「水彈對戰」快速入口（2026-09-22 自 Home.tsx 拆出；拆成小元件符合函式 ≤50 行）
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { BattleSlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Swords } from "lucide-react";

/** 🆕 把 YYYY-MM-DD 格式化為「4/25 週五」 */
function formatSlotDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}/${d.getDate()} 週${weekdays[d.getDay()]}`;
  } catch {
    return isoDate;
  }
}

/** 開放中的對戰時段（今天起、open / confirmed） */
function useOpenBattleSlots(): BattleSlot[] {
  const { data: slots = [] } = useQuery<BattleSlot[]>({
    queryKey: ["/api/battle/slots/open"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const res = await apiRequest("GET", `/api/battle/slots?fromDate=${today}`);
        const all: BattleSlot[] = await res.json();
        return all.filter((s) => s.status === "open" || s.status === "confirmed");
      } catch {
        return [];
      }
    },
  });
  return slots;
}

function SlotRow({ slot }: { slot: BattleSlot }) {
  const max = slot.maxPlayersOverride ?? 8;
  const curr = slot.currentCount ?? 0;
  const isFull = curr >= max;
  return (
    <Link
      href={`/battle/slot/${slot.id}`}
      className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
      data-testid={`battle-quick-slot-${slot.id}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-mono text-muted-foreground shrink-0">{formatSlotDate(slot.slotDate)}</span>
        <span className="text-xs text-foreground shrink-0">
          {(slot.startTime || "").slice(0, 5)}–{(slot.endTime || "").slice(0, 5)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[10px] font-mono ${isFull ? "text-muted-foreground" : "text-tactical-orange"}`}>
          {curr}/{max}
        </span>
        {isFull ? (
          <Badge variant="secondary" className="h-5 text-[10px] px-1.5">滿員</Badge>
        ) : (
          <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-tactical-orange/40 text-tactical-orange">
            開放
          </Badge>
        )}
      </div>
    </Link>
  );
}

function EntryHeader({ openCount }: { openCount: number }) {
  return (
    <Link href="/battle" className="block">
      <CardContent className="p-4 sm:p-6 cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tactical-orange/20 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-tactical-orange" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg group-hover:text-tactical-orange transition-colors">
                水彈對戰 PK 擂台
              </h3>
              <p className="text-sm text-muted-foreground">
                {openCount > 0 ? `目前開放 ${openCount} 場對戰` : "查看對戰時段與排行榜"}
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-tactical-orange/30 text-tactical-orange hover:bg-tactical-orange/10 shrink-0">
            前往對戰 →
          </Button>
        </div>
      </CardContent>
    </Link>
  );
}

/** 對戰快速入口卡片 — 顯示即將開打的 3 場 */
export default function BattleQuickEntry() {
  const slots = useOpenBattleSlots();
  const upcoming = [...slots]
    .sort((a, b) => `${a.slotDate}T${a.startTime}`.localeCompare(`${b.slotDate}T${b.startTime}`))
    .slice(0, 3);

  return (
    <Card className="mb-8 bg-card border-tactical-orange/30 hover-elevate group overflow-hidden">
      <EntryHeader openCount={slots.length} />
      {/* 🆕 近期場次預覽（最多 3 場）*/}
      {upcoming.length > 0 && (
        <div className="border-t border-border/50 bg-muted/20 px-4 sm:px-6 py-3">
          <p className="text-[11px] font-display uppercase tracking-wider text-muted-foreground mb-2">近期場次</p>
          <div className="space-y-1.5">
            {upcoming.map((slot) => <SlotRow key={slot.id} slot={slot} />)}
          </div>
        </div>
      )}
    </Card>
  );
}
