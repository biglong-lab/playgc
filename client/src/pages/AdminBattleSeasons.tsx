// 水彈對戰 PK 擂台 — 管理端賽季管理
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { tierLabels } from "@shared/schema";
import type { BattleSeason } from "@shared/schema";
import { Calendar, Plus, Trophy, AlertTriangle, Clock } from "lucide-react";

interface SeasonRanking {
  id: string;
  userId: string;
  finalRating: number;
  finalTier: string;
  tierLabel: string;
  totalBattles: number;
  wins: number;
  rank: number;
}

export default function AdminBattleSeasons() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const fieldId = admin?.fieldId;

  const [showCreate, setShowCreate] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [viewRankingsId, setViewRankingsId] = useState<string | null>(null);

  // 表單
  const [seasonName, setSeasonName] = useState("");
  const [resetTo, setResetTo] = useState(1000);

  const { data: seasons = [] } = useQuery<BattleSeason[]>({
    queryKey: ["/api/admin/battle/seasons", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/seasons?fieldId=${fieldId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const activeSeason = seasons.find((s) => s.status === "active");

  const { data: seasonRankings = [] } = useQuery<SeasonRanking[]>({
    queryKey: ["/api/admin/battle/seasons/rankings", viewRankingsId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/seasons/${viewRankingsId}/rankings?limit=50`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewRankingsId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/battle/seasons", {
        fieldId,
        name: seasonName,
        startDate: new Date().toISOString(),
        resetRatingTo: resetTo,
      });
    },
    onSuccess: () => {
      toast({ title: "賽季已建立" });
      setShowCreate(false);
      setSeasonName("");
      setResetTo(1000);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle/seasons"] });
    },
    onError: () => {
      toast({ title: "建立失敗", variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      if (!activeSeason) return;
      return apiRequest("POST", `/api/admin/battle/seasons/${activeSeason.id}/end`, {});
    },
    onSuccess: () => {
      toast({ title: "賽季已結束，排名已快照" });
      setShowEnd(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle/seasons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle/rankings"] });
    },
    onError: () => {
      toast({ title: "結束賽季失敗", variant: "destructive" });
    },
  });

  return (
    <UnifiedAdminLayout title="賽季管理">
      <div className="space-y-6">
        {/* 當前賽季 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                當前賽季
              </span>
              {!activeSeason && (
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  建立新賽季
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSeason ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{activeSeason.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      第 {activeSeason.seasonNumber} 賽季 · 開始於{" "}
                      {new Date(activeSeason.startDate).toLocaleDateString("zh-TW")}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">進行中</Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowEnd(true)}
                >
                  結束賽季
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                目前沒有進行中的賽季
              </p>
            )}
          </CardContent>
        </Card>

        {/* 歷史賽季 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              歷史賽季
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seasons.filter((s) => s.status === "ended").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">尚無歷史賽季</p>
            ) : (
              <div className="space-y-3">
                {seasons
                  .filter((s) => s.status === "ended")
                  .map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          第 {s.seasonNumber} 賽季 ·{" "}
                          {new Date(s.startDate).toLocaleDateString("zh-TW")}
                          {s.endDate && ` ~ ${new Date(s.endDate).toLocaleDateString("zh-TW")}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewRankingsId(s.id)}
                      >
                        <Trophy className="h-3.5 w-3.5 mr-1" />
                        排名
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 建立賽季 Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立新賽季</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>賽季名稱</Label>
              <Input
                placeholder="例如：2026 春季賽"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
              />
            </div>
            <div>
              <Label>賽季結束時重置積分為</Label>
              <Input
                type="number"
                min={0}
                max={5000}
                value={resetTo}
                onChange={(e) => setResetTo(parseInt(e.target.value) || 1000)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                賽季結束時所有玩家的積分將重置為此值
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!seasonName || createMutation.isPending}
            >
              {createMutation.isPending ? "建立中..." : "建立賽季"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 結束賽季確認 Dialog */}
      <Dialog open={showEnd} onOpenChange={setShowEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              確認結束賽季
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              結束「{activeSeason?.name}」將會：
            </p>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
              <li>快照所有玩家的當前排名</li>
              <li>將所有玩家積分重置為 {activeSeason?.resetRatingTo ?? 1000}</li>
              <li>此操作不可撤銷</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnd(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
            >
              {endMutation.isPending ? "處理中..." : "確認結束"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看賽季排名 Dialog */}
      <Dialog open={!!viewRankingsId} onOpenChange={(open) => !open && setViewRankingsId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>賽季排名</DialogTitle>
          </DialogHeader>
          {seasonRankings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">無排名資料</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-center py-2 w-10">#</th>
                    <th className="text-left py-2">玩家</th>
                    <th className="text-center py-2">段位</th>
                    <th className="text-center py-2">積分</th>
                    <th className="text-center py-2">場次</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonRankings.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="text-center py-2 font-bold text-muted-foreground">{r.rank}</td>
                      <td className="py-2 truncate max-w-[100px]">{r.userId.slice(0, 10)}...</td>
                      <td className="text-center py-2">
                        <Badge variant="outline" className="text-xs">
                          {tierLabels[r.finalTier as keyof typeof tierLabels] ?? r.finalTier}
                        </Badge>
                      </td>
                      <td className="text-center py-2 font-medium">{r.finalRating}</td>
                      <td className="text-center py-2">{r.totalBattles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}
