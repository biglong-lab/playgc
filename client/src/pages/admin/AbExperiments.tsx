// 🔬 P14-7: A/B 實驗管理頁面
//
// 功能：
//   1. 實驗清單（依狀態篩選 / 場域隔離）
//   2. 建立新實驗（指定 page+key+A/B index）
//   3. 啟動 / 結束實驗
//   4. 結果儀表板（z-test / p-value / effect size / 結論）
//
// 範圍限制（不擴散）：
//   - 不做變體預覽（admin 自行記得 index 對應內容）
//   - 不做即時自動結論（cron 跑）
//   - 不做多臂（>2 組）

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FlaskConical,
  Play,
  XCircle,
  CheckCircle2,
  BarChart3,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";

interface AbExperiment {
  id: string;
  fieldId: string | null;
  gameId: string | null;
  name: string;
  description: string | null;
  experimentType: string;
  targetPageId: string | null;
  targetVariantKey: string | null;
  variantAIndex: number | null;
  variantBIndex: number | null;
  status: "draft" | "running" | "completed" | "abandoned";
  conclusion: string | null;
  conclusionStats: unknown;
  minAssignmentsForConclusion: number;
  significanceLevel: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

interface AbStats {
  experimentId: string;
  groupA: { assignments: number; likes: number; dislikes: number; rate: number };
  groupB: { assignments: number; likes: number; dislikes: number; rate: number };
  pValue: number;
  zStatistic: number;
  effectSize: number;
  totalAssignments: number;
  conclusion: "a_wins" | "b_wins" | "no_difference" | "insufficient_data";
  conclusionReason: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  running: "執行中",
  completed: "已完成",
  abandoned: "已中止",
};

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  running: "default",
  completed: "secondary",
  abandoned: "destructive",
};

const CONCLUSION_LABELS: Record<string, string> = {
  a_wins: "A 組勝出",
  b_wins: "B 組勝出",
  no_difference: "無顯著差異",
  insufficient_data: "資料不足",
};

export default function AbExperiments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState<string | null>(null);

  // 列表
  const { data: list, isLoading } = useQuery<{
    experiments: AbExperiment[];
    count: number;
  }>({
    queryKey: ["/api/admin/ab-experiments", statusFilter],
    queryFn: () =>
      fetchWithAdminAuth(
        `/api/admin/ab-experiments${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`,
      ),
  });

  // 建立
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchWithAdminAuth(`/api/admin/ab-experiments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "實驗已建立" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ab-experiments"] });
      setCreateOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  // 更新狀態
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchWithAdminAuth(`/api/admin/ab-experiments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast({ title: "狀態已更新" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ab-experiments"] });
    },
    onError: (err: Error) => {
      toast({ title: "更新失敗", description: err.message, variant: "destructive" });
    },
  });

  // 刪除
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchWithAdminAuth(`/api/admin/ab-experiments/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: "實驗已刪除" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ab-experiments"] });
    },
    onError: (err: Error) => {
      toast({ title: "刪除失敗", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">A/B 實驗</h1>
            <p className="text-sm text-muted-foreground">
              統計顯著性測試 — 自動找出更受玩家喜愛的變體
            </p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-experiment">
              <Plus className="w-4 h-4 mr-2" />
              建立實驗
            </Button>
          </DialogTrigger>
          <CreateExperimentDialog
            onSubmit={(payload) => createMutation.mutate(payload)}
            loading={createMutation.isPending}
          />
        </Dialog>
      </div>

      {/* 篩選 */}
      <div className="flex gap-2 items-center">
        <Label htmlFor="status-filter">狀態</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="status-filter" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="running">執行中</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
            <SelectItem value="abandoned">已中止</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>實驗清單（{list?.count ?? 0}）</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !list?.experiments.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              尚無實驗
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名稱</TableHead>
                  <TableHead>目標</TableHead>
                  <TableHead>A/B Index</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>結論</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.experiments.map((exp) => (
                  <TableRow key={exp.id} data-testid={`row-experiment-${exp.id}`}>
                    <TableCell>
                      <div className="font-medium">{exp.name}</div>
                      {exp.description && (
                        <div className="text-xs text-muted-foreground">
                          {exp.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{exp.targetPageId}</div>
                      <div className="text-muted-foreground">{exp.targetVariantKey}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      A: {exp.variantAIndex} / B: {exp.variantBIndex}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[exp.status]}>
                        {STATUS_LABELS[exp.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {exp.conclusion ? (
                        <Badge variant="secondary">
                          {CONCLUSION_LABELS[exp.conclusion] ?? exp.conclusion}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {exp.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMutation.mutate({ id: exp.id, status: "running" })
                            }
                            data-testid={`button-start-${exp.id}`}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            啟動
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`確定刪除實驗 "${exp.name}"？`)) {
                                deleteMutation.mutate(exp.id);
                              }
                            }}
                            data-testid={`button-delete-${exp.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {exp.status === "running" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResultOpen(exp.id)}
                            data-testid={`button-results-${exp.id}`}
                          >
                            <BarChart3 className="w-3 h-3 mr-1" />
                            結果
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateMutation.mutate({ id: exp.id, status: "completed" })
                            }
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            完成
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateMutation.mutate({ id: exp.id, status: "abandoned" })
                            }
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {(exp.status === "completed" || exp.status === "abandoned") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResultOpen(exp.id)}
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          結果
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 結果對話框 */}
      <Dialog
        open={!!resultOpen}
        onOpenChange={(open) => !open && setResultOpen(null)}
      >
        {resultOpen && <ResultsDialog experimentId={resultOpen} />}
      </Dialog>
    </div>
  );
}

// ============================================================================
// 建立實驗 dialog
// ============================================================================
function CreateExperimentDialog({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: Record<string, unknown>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetPageId: "",
    targetVariantKey: "success",
    variantAIndex: 0,
    variantBIndex: 1,
    minAssignmentsForConclusion: 50,
    significanceLevel: "0.05",
  });

  const valid =
    form.name.length > 0 &&
    form.targetPageId.length > 0 &&
    form.variantAIndex !== form.variantBIndex;

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>建立 A/B 實驗</DialogTitle>
        <DialogDescription>
          指定 page + variant key + A/B index → 系統會把玩家依 hash 分組
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>名稱</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例：success 訊息語氣 A/B"
            data-testid="input-name"
          />
        </div>
        <div className="space-y-2">
          <Label>說明（選填）</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>目標 Page ID</Label>
          <Input
            value={form.targetPageId}
            onChange={(e) => setForm({ ...form, targetPageId: e.target.value })}
            placeholder="page UUID"
            data-testid="input-page-id"
          />
        </div>
        <div className="space-y-2">
          <Label>變體類別</Label>
          <Select
            value={form.targetVariantKey}
            onValueChange={(v) => setForm({ ...form, targetVariantKey: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="success">success</SelectItem>
              <SelectItem value="fail">fail</SelectItem>
              <SelectItem value="nearMiss">nearMiss</SelectItem>
              <SelectItem value="hint">hint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>A 組 Index</Label>
            <Input
              type="number"
              min="0"
              value={form.variantAIndex}
              onChange={(e) =>
                setForm({ ...form, variantAIndex: parseInt(e.target.value, 10) || 0 })
              }
              data-testid="input-variant-a"
            />
          </div>
          <div className="space-y-2">
            <Label>B 組 Index</Label>
            <Input
              type="number"
              min="0"
              value={form.variantBIndex}
              onChange={(e) =>
                setForm({ ...form, variantBIndex: parseInt(e.target.value, 10) || 0 })
              }
              data-testid="input-variant-b"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>結論最少分組數</Label>
            <Input
              type="number"
              min="10"
              value={form.minAssignmentsForConclusion}
              onChange={(e) =>
                setForm({
                  ...form,
                  minAssignmentsForConclusion: parseInt(e.target.value, 10) || 50,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>顯著性閾值 (p)</Label>
            <Input
              value={form.significanceLevel}
              onChange={(e) =>
                setForm({ ...form, significanceLevel: e.target.value })
              }
              placeholder="0.05"
            />
          </div>
        </div>
        {form.variantAIndex === form.variantBIndex && (
          <p className="text-xs text-destructive">A 組和 B 組 index 不能相同</p>
        )}
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!valid || loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          建立草稿
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============================================================================
// 結果儀表板 dialog
// ============================================================================
function ResultsDialog({ experimentId }: { experimentId: string }) {
  const { data, isLoading } = useQuery<{
    experiment: { id: string; name: string; status: string };
    stats: AbStats;
  }>({
    queryKey: ["/api/admin/ab-experiments", experimentId, "results"],
    queryFn: () =>
      fetchWithAdminAuth(`/api/admin/ab-experiments/${experimentId}/results`),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          <BarChart3 className="w-5 h-5 inline mr-2" />
          實驗結果
        </DialogTitle>
        <DialogDescription>
          {data?.experiment.name ?? "載入中…"}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">無資料</p>
      ) : (
        <div className="space-y-4 py-4">
          {/* 結論 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">結論</CardTitle>
              <CardDescription>{data.stats.conclusionReason}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge
                variant={
                  data.stats.conclusion === "a_wins" ||
                  data.stats.conclusion === "b_wins"
                    ? "default"
                    : "secondary"
                }
                className="text-sm"
              >
                {CONCLUSION_LABELS[data.stats.conclusion]}
              </Badge>
            </CardContent>
          </Card>

          {/* AB 對照 */}
          <div className="grid grid-cols-2 gap-4">
            <GroupStatsCard label="A 組" stats={data.stats.groupA} />
            <GroupStatsCard label="B 組" stats={data.stats.groupB} />
          </div>

          {/* 統計細節 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">統計細節</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">總分組數</dt>
                <dd>{data.stats.totalAssignments}</dd>
                <dt className="text-muted-foreground">z 值</dt>
                <dd>{data.stats.zStatistic.toFixed(4)}</dd>
                <dt className="text-muted-foreground">p 值</dt>
                <dd>{data.stats.pValue.toFixed(4)}</dd>
                <dt className="text-muted-foreground">效果量</dt>
                <dd>{(data.stats.effectSize * 100).toFixed(2)}%</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </DialogContent>
  );
}

function GroupStatsCard({
  label,
  stats,
}: {
  label: string;
  stats: { assignments: number; likes: number; dislikes: number; rate: number };
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">分組</dt>
          <dd>{stats.assignments}</dd>
          <dt className="text-muted-foreground">👍 Likes</dt>
          <dd className="text-green-600">{stats.likes}</dd>
          <dt className="text-muted-foreground">👎 Dislikes</dt>
          <dd className="text-red-600">{stats.dislikes}</dd>
          <dt className="text-muted-foreground">滿意度</dt>
          <dd className="font-medium">{(stats.rate * 100).toFixed(1)}%</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
