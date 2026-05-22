// 🆘 Admin — 卡關玩家救援面板
//
// 用途：當玩家因 GPS 失效、QR 掃不到、代碼錯誤等問題卡在某個任務點，
//      管理員可在控制台一鍵標記到達
//
// 2026-05-22

import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Loader2,
  Users,
} from "lucide-react";

interface PendingLocation {
  id: number;
  name: string;
  verificationMode: string | null;
  allowAdminRescue: boolean | null;
  orderIndex: number | null;
}

interface StuckPlayer {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  score: number;
  stuckMinutes: number;
  isStuck: boolean;
  completedCount: number;
  totalCount: number;
  pendingLocations: PendingLocation[];
}

interface StuckPlayersResponse {
  sessionId: string;
  gameId: string;
  totalLocations: number;
  players: StuckPlayer[];
}

export default function StuckPlayersPanel() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<StuckPlayersResponse>({
    queryKey: ["/api/admin/sessions", sessionId, "stuck-players"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/sessions/${sessionId}/stuck-players`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 10_000, // 10s 自動 refresh
  });

  const rescueMutation = useMutation({
    mutationFn: async (data: { playerId: string; locationId: number; reason: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/sessions/${sessionId}/rescue/${data.playerId}/visit/${data.locationId}`,
        { reason: data.reason },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/sessions", sessionId, "stuck-players"],
      });
      toast({ title: "✅ 已標記到達" });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message || "救援失敗";
      toast({ title: "救援失敗", description: msg, variant: "destructive" });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const stuckPlayers = data.players.filter((p) => p.isStuck);
  const activePlayers = data.players.filter((p) => !p.isStuck && p.completedCount < p.totalCount);
  const completedPlayers = data.players.filter((p) => p.completedCount === p.totalCount);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/admin/sessions/${sessionId}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              卡關玩家救援
            </h1>
            <p className="text-xs text-muted-foreground">
              Session: {sessionId} ・ 共 {data.totalLocations} 個任務點
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="destructive">卡關 {stuckPlayers.length}</Badge>
          <Badge variant="secondary">進行中 {activePlayers.length}</Badge>
          <Badge variant="outline">已完成 {completedPlayers.length}</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* 卡關玩家 */}
        {stuckPlayers.length > 0 && (
          <section>
            <h2 className="font-medium text-sm mb-2 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              卡關玩家（{stuckPlayers.length}）
            </h2>
            <div className="space-y-2">
              {stuckPlayers.map((p) => (
                <PlayerCard
                  key={p.userId}
                  player={p}
                  onRescue={(locationId, reason) =>
                    rescueMutation.mutate({ playerId: p.userId, locationId, reason })
                  }
                  isLoading={rescueMutation.isPending}
                />
              ))}
            </div>
          </section>
        )}

        {/* 進行中玩家 */}
        {activePlayers.length > 0 && (
          <section>
            <h2 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              進行中（{activePlayers.length}）
            </h2>
            <div className="space-y-2">
              {activePlayers.map((p) => (
                <PlayerCard
                  key={p.userId}
                  player={p}
                  onRescue={(locationId, reason) =>
                    rescueMutation.mutate({ playerId: p.userId, locationId, reason })
                  }
                  isLoading={rescueMutation.isPending}
                />
              ))}
            </div>
          </section>
        )}

        {/* 已完成玩家 */}
        {completedPlayers.length > 0 && (
          <section>
            <h2 className="font-medium text-sm mb-2 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              已完成（{completedPlayers.length}）
            </h2>
            <div className="space-y-2">
              {completedPlayers.map((p) => (
                <Card key={p.userId} className="opacity-70">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={p.profileImageUrl || undefined} />
                      <AvatarFallback>{p.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.completedCount}/{p.totalCount} ・ {p.score} 分
                      </p>
                    </div>
                    <Badge variant="outline" className="text-success">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      完成
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.players.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-3" />
              <p>此 session 沒有玩家</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 玩家卡片 + 救援 Dialog
// ────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: StuckPlayer;
  onRescue: (locationId: number, reason: string) => void;
  isLoading: boolean;
}

function PlayerCard({ player, onRescue, isLoading }: PlayerCardProps) {
  const [dialogLocation, setDialogLocation] = useState<PendingLocation | null>(null);
  const [reason, setReason] = useState("");

  const handleRescue = () => {
    if (!dialogLocation) return;
    onRescue(dialogLocation.id, reason || "管理員救援");
    setDialogLocation(null);
    setReason("");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={player.profileImageUrl || undefined} />
            <AvatarFallback>{player.displayName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-base">{player.displayName}</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>
                進度 {player.completedCount}/{player.totalCount}
              </span>
              <span>・ {player.score} 分</span>
              {player.stuckMinutes >= 5 && (
                <Badge variant="destructive" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {player.stuckMinutes} 分鐘無進度
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {player.pendingLocations.length === 0 ? (
          <p className="text-xs text-muted-foreground">全部完成</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-1">未簽到任務點：</p>
            {player.pendingLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    #{loc.orderIndex ?? loc.id}
                  </span>
                  <span>{loc.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {loc.verificationMode || "gps"}
                  </Badge>
                </div>
                {loc.allowAdminRescue !== false && (
                  <Dialog
                    open={dialogLocation?.id === loc.id}
                    onOpenChange={(open) => !open && setDialogLocation(null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialogLocation(loc)}
                        disabled={isLoading}
                        data-testid={`button-rescue-${player.userId}-${loc.id}`}
                      >
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        標記到達
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>確認管理員救援</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-2">
                        <p className="text-sm">
                          將為 <strong>{player.displayName}</strong> 強制標記任務點
                          <strong className="mx-1">{loc.name}</strong>
                          為已到達，並加上對應分數。
                        </p>
                        <div className="space-y-1">
                          <Label htmlFor="reason">救援理由（可選）</Label>
                          <Input
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="如：GPS 失效、QR 損壞..."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogLocation(null)}>
                          取消
                        </Button>
                        <Button onClick={handleRescue} disabled={isLoading}>
                          確認救援
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
