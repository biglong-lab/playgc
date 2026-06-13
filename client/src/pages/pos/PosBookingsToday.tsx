// 📱 POS 今日預約清單（2026-05-18）
//
// 路徑：/pos/bookings/today
// 列表 + 一鍵操作：標到場 / 標未到 / 直接收款

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, DollarSign, Search, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

interface TodayBooking {
  id: number;
  bookingCode: string;
  displayName: string | null;
  phone?: string | null;
  slotStart: string;
  slotEnd: string;
  partySize: number;
  status: string;
  paymentStatus: string;
  amountCents: number;
  checkedInAt: string | null;
  paidAt: string | null;
  activity?: { name: string; coverUrl?: string | null } | null;
}

interface DashboardResp {
  todayBookings: TodayBooking[];
  stats: { totalBookings: number };
}

export default function PosBookingsToday() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<DashboardResp>({
    queryKey: ["pos-dashboard"],
    queryFn: async () => await fetchWithAdminAuth("/api/pos/dashboard"),
    refetchInterval: 30_000,
  });

  const checkInMut = useMutation({
    mutationFn: async (id: number) =>
      await fetchWithAdminAuth(`/api/pos/bookings/${id}/check-in`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "✅ 已報到" });
      qc.invalidateQueries({ queryKey: ["pos-dashboard"] });
    },
  });

  const noShowMut = useMutation({
    mutationFn: async (id: number) =>
      await fetchWithAdminAuth(`/api/pos/bookings/${id}/no-show`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "已標記未到" });
      qc.invalidateQueries({ queryKey: ["pos-dashboard"] });
    },
  });

  const filtered = useMemo(() => {
    const list = data?.todayBookings ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (b) =>
        b.bookingCode.toLowerCase().includes(q) ||
        (b.displayName ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  // 按 activity 分組
  const groups = useMemo(() => {
    const m = new Map<string, TodayBooking[]>();
    for (const b of filtered) {
      const key = b.activity?.name || "（一般預約）";
      const arr = m.get(key) ?? [];
      arr.push(b);
      m.set(key, arr);
    }
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <PosLayout title="今日預約" backTo="/pos">
      <div className="mb-3 relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋姓名或預約碼"
          className="pl-9"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-6">載入中…</p>}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {search ? "找不到符合的預約" : "今日尚無預約"}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {groups.map(([groupName, list]) => (
          <section key={groupName}>
            <h3 className="text-xs font-bold text-muted-foreground mb-2 px-1">
              {groupName}（{list.length}）
            </h3>
            <div className="space-y-2">
              {list.map((b) => (
                <BookingRow
                  key={b.id}
                  b={b}
                  onCheckIn={() => checkInMut.mutate(b.id)}
                  onNoShow={() => {
                    if (confirm(`標記 ${b.displayName} 為未到場？`)) noShowMut.mutate(b.id);
                  }}
                  onCheckout={() => navigate(`/pos/checkout?bookingId=${b.id}`)}
                  busy={checkInMut.isPending || noShowMut.isPending}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PosLayout>
  );
}

function BookingRow({
  b,
  onCheckIn,
  onNoShow,
  onCheckout,
  busy,
}: {
  b: TodayBooking;
  onCheckIn: () => void;
  onNoShow: () => void;
  onCheckout: () => void;
  busy: boolean;
}) {
  const t = new Date(b.slotStart);
  const timeStr = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  const arrived = !!b.checkedInAt;
  const paid = b.paymentStatus === "paid" || !!b.paidAt;
  const cancelled = b.status === "cancelled" || b.status === "no_show";

  return (
    <Card className={cancelled ? "opacity-50" : ""}>
      <CardContent className="py-3 px-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-primary min-w-[3rem]">{timeStr}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{b.displayName || "—"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {b.partySize} 人 · {b.bookingCode}
              {b.amountCents > 0 && ` · NT$${(b.amountCents / 100).toFixed(0)}`}
            </p>
            {b.phone && (
              <a
                href={`tel:${b.phone}`}
                className="text-xs text-primary truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                📞 {b.phone}
              </a>
            )}
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            {cancelled && (
              <Badge variant="outline" className="text-xs">
                {b.status === "no_show" ? "未到" : "已取消"}
              </Badge>
            )}
            {arrived && !cancelled && (
              <Badge className="text-xs bg-green-600">✓ 到場</Badge>
            )}
            {paid && (
              <Badge className="text-xs bg-blue-600">✓ 已收</Badge>
            )}
          </div>
        </div>

        {!cancelled && (
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              variant={arrived ? "outline" : "default"}
              onClick={onCheckIn}
              disabled={busy || arrived}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              <span className="text-xs ml-1">{arrived ? "已到" : "報到"}</span>
            </Button>
            <Button
              size="sm"
              variant={paid ? "outline" : "default"}
              className={!paid && b.amountCents > 0 ? "bg-amber-600 hover:bg-amber-700" : ""}
              onClick={onCheckout}
              disabled={paid || b.amountCents === 0}
            >
              <DollarSign className="w-3 h-3" />
              <span className="text-xs ml-1">{paid ? "已收" : "收款"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={onNoShow} disabled={busy}>
              <XCircle className="w-3 h-3" />
              <span className="text-xs ml-1">未到</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
