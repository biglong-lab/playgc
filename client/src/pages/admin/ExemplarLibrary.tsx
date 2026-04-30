// 🖼️ 場域素材庫管理頁
//
// admin 用來瀏覽和管理 cron 自動策展的玩家成功照
// 主要操作：
//   1. 看本場域所有 exemplar 照片（含 confidence、來源）
//   2. 標記為「精選」(is_curated=true)，未來 compare-photos 會優先用
//   3. 編輯 tags / description
//   4. 刪除不適合的素材
//
// 用法：admin 進入後篩選想看的遊戲/頁面，標記精選即可
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Star, StarOff, Trash2, ImageIcon, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExemplarPhoto {
  id: string;
  fieldId: string;
  gameId: string | null;
  pageId: string | null;
  photoUrl: string;
  confidence: string | null;
  source: "player_success" | "admin_upload" | "cron_collected";
  isCurated: boolean;
  tags: string | null;
  description: string | null;
  createdAt: string;
}

interface ExemplarListResponse {
  total: number;
  items: ExemplarPhoto[];
}

const SOURCE_LABELS: Record<ExemplarPhoto["source"], string> = {
  player_success: "🎮 玩家成功",
  admin_upload: "👤 admin 上傳",
  cron_collected: "🤖 cron 自動",
};

export default function ExemplarLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { admin } = useAdminAuth();
  const fieldId = admin?.fieldId;

  // 篩選狀態
  const [pageIdFilter, setPageIdFilter] = useState("");
  const [showOnlyCurated, setShowOnlyCurated] = useState(false);

  const queryParams = new URLSearchParams();
  if (fieldId) queryParams.set("fieldId", fieldId);
  if (pageIdFilter) queryParams.set("pageId", pageIdFilter);
  if (showOnlyCurated) queryParams.set("isCurated", "true");

  const { data, isLoading } = useQuery<ExemplarListResponse>({
    queryKey: ["/api/admin/exemplar", queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/exemplar?${queryParams.toString()}`);
      return res.json();
    },
    enabled: !!fieldId,
  });

  const toggleCuratedMutation = useMutation({
    mutationFn: async ({ id, isCurated }: { id: string; isCurated: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/exemplar/${id}`, { isCurated });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exemplar"] });
      toast({ title: "✓ 已更新精選狀態" });
    },
    onError: (err: Error) => {
      toast({ title: "❌ 更新失敗", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/exemplar/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/exemplar"] });
      toast({ title: "✓ 已刪除素材" });
    },
    onError: (err: Error) => {
      toast({ title: "❌ 刪除失敗", description: err.message, variant: "destructive" });
    },
  });

  const items = data?.items ?? [];
  const curatedCount = items.filter((i) => i.isCurated).length;

  return (
    <UnifiedAdminLayout title="場域素材庫">
      <div className="p-4 space-y-4">
        {/* 統計 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">場域總素材</p>
                  <p className="text-2xl font-bold">{data?.total ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium">精選範本</p>
                  <p className="text-2xl font-bold text-yellow-600">{curatedCount}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 標記精選的範本，會被 <code>/api/ai/compare-photos</code> 在 useExemplar=true 時優先使用
            </p>
          </CardContent>
        </Card>

        {/* 篩選 */}
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="輸入 pageId 篩選"
              value={pageIdFilter}
              onChange={(e) => setPageIdFilter(e.target.value)}
              className="max-w-xs h-8"
              data-testid="input-filter-page"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={showOnlyCurated}
                onCheckedChange={setShowOnlyCurated}
                data-testid="switch-only-curated"
              />
              <span className="text-sm">只看精選</span>
            </div>
          </CardContent>
        </Card>

        {/* 列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚無素材</p>
              <p className="text-xs mt-1">玩家通過 AI 驗證的高分照片會被 cron 自動加入</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
              <Card key={item.id} className={item.isCurated ? "ring-2 ring-yellow-400" : ""}>
                <CardContent className="p-2 space-y-2">
                  <div className="aspect-square bg-muted rounded overflow-hidden relative">
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {item.isCurated && (
                      <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 rounded-full p-1">
                        <Star className="w-4 h-4 fill-current" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {SOURCE_LABELS[item.source]}
                    </Badge>
                    {item.confidence && (
                      <Badge variant="outline" className="text-[10px]">
                        信心 {Math.round(parseFloat(item.confidence) * 100)}%
                      </Badge>
                    )}
                  </div>

                  {item.pageId && (
                    <p className="text-[10px] text-muted-foreground truncate font-mono" title={item.pageId}>
                      page: {item.pageId.substring(0, 12)}...
                    </p>
                  )}

                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={item.isCurated ? "default" : "outline"}
                      className="flex-1 h-8 text-xs"
                      onClick={() =>
                        toggleCuratedMutation.mutate({ id: item.id, isCurated: !item.isCurated })
                      }
                      disabled={toggleCuratedMutation.isPending}
                      data-testid={`button-toggle-curated-${item.id}`}
                    >
                      {item.isCurated ? (
                        <>
                          <StarOff className="w-3 h-3 mr-1" />
                          取消精選
                        </>
                      ) : (
                        <>
                          <Star className="w-3 h-3 mr-1" />
                          設為精選
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (confirm("確定要刪除此素材？")) deleteMutation.mutate(item.id);
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}
