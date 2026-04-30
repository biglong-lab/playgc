// 🎨 變體池編輯器（admin 後台用）
//
// UI：
//   ┌─ 訊息變體池 ─────────────────────────┐
//   │  ✓ 8 成功訊息 / 6 失敗訊息            │
//   │  最後生成：2026-04-30 (DeepSeek V3.2) │
//   │  [✨ AI 生成]  [✏️ 編輯]              │
//   └─────────────────────────────────────┘
//
// 功能：
//   - 顯示當前變體池狀態（type 計數）
//   - ✨ 一鍵 AI 生成（呼叫 POST /generate-variants）
//   - ✏️ 手動編輯（展開列表，可增刪改）
//   - 全部變更走 PATCH /variants
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Edit2, X, Plus, Save, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  countVariants,
  type VariantPoolShape,
  type VariantPoolKey,
} from "@/lib/variant-picker";

interface VariantPoolEditorProps {
  gameId: string;
  pageId: string;
  /** 任務情境（給 AI 生成參考），通常用 page.config.title 或 instruction */
  defaultTaskContext?: string;
}

const CATEGORY_LABELS: Record<VariantPoolKey, string> = {
  success: "✅ 成功訊息",
  fail: "😢 失敗鼓勵",
  nearMiss: "🤏 接近通過",
  hint: "💡 提示訊息",
};

export default function VariantPoolEditor({
  gameId,
  pageId,
  defaultTaskContext = "",
}: VariantPoolEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // 表單狀態（生成）
  const [taskContext, setTaskContext] = useState(defaultTaskContext);
  const [count, setCount] = useState(8);
  const [fieldStyle, setFieldStyle] = useState("");
  const [categories, setCategories] = useState<VariantPoolKey[]>(["success", "fail"]);

  // 取得當前 pool
  const { data: poolData } = useQuery<{ pool: VariantPoolShape | null }>({
    queryKey: ["/api/admin/games", gameId, "pages", pageId, "variants"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/games/${gameId}/pages/${pageId}/variants`,
      );
      return res.json();
    },
    enabled: !!gameId && !!pageId,
  });

  // 🆕 P11-9: 取得變體反饋分數（admin 看每個變體 like/dislike 數）
  interface VariantScoreEntry {
    likeCount: number;
    dislikeCount: number;
    skipCount: number;
    totalFeedback: number;
    score: number; // Wilson Lower Bound
    hidden: boolean;
  }
  const { data: scoresData } = useQuery<{ scores: Record<string, VariantScoreEntry> }>({
    queryKey: ["/api/admin/games", gameId, "pages", pageId, "variant-scores"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/games/${gameId}/pages/${pageId}/variant-scores`,
      );
      return res.json();
    },
    enabled: !!gameId && !!pageId && editOpen, // 開編輯 dialog 才查
  });
  const scores = scoresData?.scores ?? {};
  const getScore = (key: string, idx: number): VariantScoreEntry | null =>
    scores[`${key}|${idx}`] ?? null;

  const pool = poolData?.pool ?? null;
  const counts = countVariants(pool);

  // 編輯 state（從 pool 載入）
  const [editPool, setEditPool] = useState<VariantPoolShape>({});

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/games/${gameId}/pages/${pageId}/generate-variants`,
        { taskContext, count, fieldStyle: fieldStyle || undefined, categories },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "✨ 變體池已生成",
        description: `已用 DeepSeek V3.2 生成 ${categories.length} 類別 × ${count} 個變體`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "pages", pageId, "variants"],
      });
      setGenerateOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "❌ 生成失敗",
        description: err.message || "請檢查場域 OpenRouter API key 是否有效",
        variant: "destructive",
      });
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/games/${gameId}/pages/${pageId}/variants`,
        { pool: editPool },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✓ 已儲存變體池" });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "pages", pageId, "variants"],
      });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "❌ 儲存失敗", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    setEditPool({
      success: pool?.success ?? [],
      fail: pool?.fail ?? [],
      nearMiss: pool?.nearMiss ?? [],
      hint: pool?.hint ?? [],
      generatedAt: pool?.generatedAt,
      model: pool?.model,
    });
    setEditOpen(true);
  };

  const updateMessage = (key: VariantPoolKey, idx: number, value: string) => {
    setEditPool((p) => {
      const arr = [...(p[key] ?? [])];
      arr[idx] = value;
      return { ...p, [key]: arr };
    });
  };

  const deleteMessage = (key: VariantPoolKey, idx: number) => {
    setEditPool((p) => {
      const arr = [...(p[key] ?? [])];
      arr.splice(idx, 1);
      return { ...p, [key]: arr };
    });
  };

  const addMessage = (key: VariantPoolKey) => {
    setEditPool((p) => {
      const arr = [...(p[key] ?? []), ""];
      return { ...p, [key]: arr };
    });
  };

  const generatedDate = pool?.generatedAt
    ? new Date(pool.generatedAt).toLocaleDateString("zh-TW")
    : null;

  return (
    <Card data-testid="variant-pool-editor">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            訊息變體池
          </span>
          {counts.total > 0 && (
            <Badge variant="secondary" className="text-xs">
              {counts.total} 個變體
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {counts.total > 0 ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              {(["success", "fail", "nearMiss", "hint"] as VariantPoolKey[])
                .filter((k) => counts.byCategory[k] > 0)
                .map((k) => (
                  <Badge key={k} variant="outline" className="text-xs">
                    {CATEGORY_LABELS[k]} × {counts.byCategory[k]}
                  </Badge>
                ))}
            </div>
            {generatedDate && (
              <div>
                生成於 {generatedDate}
                {pool?.model && <span className="ml-1">({pool.model})</span>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            尚未生成變體池。玩家會看到 AI 即時回應或 fallback 訊息。
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="bg-gradient-to-r from-purple-500 to-pink-500"
            onClick={() => setGenerateOpen(true)}
            data-testid="button-generate-variants"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            ✨ AI 生成
          </Button>
          {counts.total > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openEditDialog}
              data-testid="button-edit-variants"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              編輯
            </Button>
          )}
        </div>
      </CardContent>

      {/* 生成對話框 */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✨ 用 DeepSeek V3.2 生成變體池</DialogTitle>
            <DialogDescription>
              一次性生成多樣化訊息，玩家觸發任務時隨機抽取，避免機械感。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">任務情境</label>
              <Textarea
                value={taskContext}
                onChange={(e) => setTaskContext(e.target.value)}
                placeholder="例：玩家在金門賈村古牌坊拍照打卡確認"
                rows={2}
                data-testid="input-variant-task-context"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">每類別變體數</label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 8)}
                  data-testid="input-variant-count"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">場域風格</label>
                <Input
                  value={fieldStyle}
                  onChange={(e) => setFieldStyle(e.target.value)}
                  placeholder="戰術 + 歷史"
                  data-testid="input-variant-style"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">生成類別</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_LABELS) as VariantPoolKey[]).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={categories.includes(k) ? "default" : "outline"}
                    onClick={() => {
                      setCategories((prev) =>
                        prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
                      );
                    }}
                    data-testid={`button-cat-${k}`}
                  >
                    {CATEGORY_LABELS[k]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={
                generateMutation.isPending ||
                !taskContext.trim() ||
                categories.length === 0
              }
              data-testid="button-confirm-generate"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              開始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯對話框 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ 手動編輯變體池</DialogTitle>
            <DialogDescription>
              新增、刪除或修改 AI 生成的訊息。空白訊息會被自動移除。
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="success" className="w-full">
            <TabsList className="grid grid-cols-4">
              {(Object.keys(CATEGORY_LABELS) as VariantPoolKey[]).map((k) => (
                <TabsTrigger key={k} value={k} data-testid={`tab-edit-${k}`}>
                  {CATEGORY_LABELS[k]} ({(editPool[k] ?? []).length})
                </TabsTrigger>
              ))}
            </TabsList>
            {(Object.keys(CATEGORY_LABELS) as VariantPoolKey[]).map((k) => (
              <TabsContent key={k} value={k} className="space-y-2 mt-3">
                {(editPool[k] ?? []).map((msg, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Textarea
                      value={msg}
                      onChange={(e) => updateMessage(k, idx, e.target.value)}
                      rows={1}
                      className="flex-1 min-h-[40px]"
                      placeholder="輸入訊息變體..."
                      data-testid={`textarea-msg-${k}-${idx}`}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMessage(k, idx)}
                      data-testid={`button-delete-${k}-${idx}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addMessage(k)}
                  data-testid={`button-add-${k}`}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新增訊息
                </Button>
              </TabsContent>
            ))}
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                // 過濾空字串再儲存
                const cleaned: VariantPoolShape = { ...editPool };
                (Object.keys(CATEGORY_LABELS) as VariantPoolKey[]).forEach((k) => {
                  cleaned[k] = (cleaned[k] ?? []).filter((s) => s.trim().length > 0);
                });
                setEditPool(cleaned);
                saveEditMutation.mutate();
              }}
              disabled={saveEditMutation.isPending}
              data-testid="button-save-edit"
            >
              <Save className="w-4 h-4 mr-1" />
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
