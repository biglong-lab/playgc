// 水彈對戰 PK 擂台 — 管理端排名管理
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
import { Trophy, Search, Edit2, ArrowUpDown } from "lucide-react";

interface RankingEntry {
  id: string;
  userId: string;
  fieldId: string;
  rating: number;
  tier: string;
  tierLabel: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  winStreak: number;
  bestStreak: number;
  mvpCount: number;
  rank: number;
}

export default function AdminBattleRankings() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const fieldId = admin?.fieldId;

  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<RankingEntry | null>(null);
  const [adjustRating, setAdjustRating] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const { data: rankings = [], isLoading } = useQuery<RankingEntry[]>({
    queryKey: ["/api/admin/battle/rankings", fieldId, search],
    queryFn: async () => {
      const params = new URLSearchParams({ fieldId: fieldId!, limit: "100" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/battle/rankings?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!editTarget) return;
      return apiRequest("PATCH", `/api/admin/battle/rankings/${editTarget.id}`, {
        rating: adjustRating,
        reason: adjustReason || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "排名已調整" });
      setEditTarget(null);
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/battle/rankings"] });
    },
    onError: () => {
      toast({ title: "調整失敗", variant: "destructive" });
    },
  });

  function openAdjustDialog(entry: RankingEntry) {
    setEditTarget(entry);
    setAdjustRating(entry.rating);
    setAdjustReason("");
  }

  const tierColors: Record<string, string> = {
    bronze: "bg-amber-100 text-amber-800",
    silver: "bg-gray-100 text-gray-700",
    gold: "bg-yellow-100 text-yellow-800",
    platinum: "bg-cyan-100 text-cyan-800",
    diamond: "bg-blue-100 text-blue-800",
    master: "bg-purple-100 text-purple-800",
  };

  return (
    <UnifiedAdminLayout title="排名管理">
      <div className="space-y-4">
        {/* 搜尋列 */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋玩家 ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 排名表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              玩家排名（共 {rankings.length} 名）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">載入中...</p>
            ) : rankings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {search ? "無符合的搜尋結果" : "尚無排名資料"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-center py-2 px-2 w-12">#</th>
                      <th className="text-left py-2 px-2">玩家</th>
                      <th className="text-center py-2 px-2">段位</th>
                      <th className="text-center py-2 px-2">
                        <span className="flex items-center justify-center gap-1">
                          積分 <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-center py-2 px-2">場次</th>
                      <th className="text-center py-2 px-2">勝率</th>
                      <th className="text-center py-2 px-2">連勝</th>
                      <th className="text-center py-2 px-2">MVP</th>
                      <th className="text-center py-2 px-2 w-16">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="text-center py-2 px-2 font-bold text-muted-foreground">
                          {r.rank}
                        </td>
                        <td className="py-2 px-2 truncate max-w-[120px]">
                          {r.userId.slice(0, 12)}...
                        </td>
                        <td className="text-center py-2 px-2">
                          <Badge className={`text-xs ${tierColors[r.tier] ?? ""}`}>
                            {r.tierLabel}
                          </Badge>
                        </td>
                        <td className="text-center py-2 px-2 font-medium">{r.rating}</td>
                        <td className="text-center py-2 px-2">
                          {r.wins}/{r.losses}/{r.draws}
                        </td>
                        <td className="text-center py-2 px-2">{r.winRate}%</td>
                        <td className="text-center py-2 px-2">{r.bestStreak}</td>
                        <td className="text-center py-2 px-2">{r.mvpCount}</td>
                        <td className="text-center py-2 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAdjustDialog(r)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 手動調整 Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手動調整積分</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>玩家</Label>
              <p className="text-sm text-muted-foreground">{editTarget?.userId}</p>
            </div>
            <div>
              <Label>目前積分</Label>
              <p className="text-sm">{editTarget?.rating} ({editTarget?.tierLabel})</p>
            </div>
            <div>
              <Label>新積分</Label>
              <Input
                type="number"
                min={0}
                max={5000}
                value={adjustRating}
                onChange={(e) => setAdjustRating(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>調整原因（選填）</Label>
              <Input
                placeholder="例如：測試帳號修正"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button
              onClick={() => adjustMutation.mutate()}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? "儲存中..." : "確認調整"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}
