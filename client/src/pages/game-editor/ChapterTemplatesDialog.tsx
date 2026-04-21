// 📚 章節模板對話框
//
// 兩種模式：
//   - save:   把現有章節存成模板（prompt 標題/描述/分類 → POST save-as-template）
//   - import: 列出場域所有模板，選一個匯入到當前遊戲
//
// 匯入後若有 page 需要重新設定（game-specific 引用），顯示警告清單。
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import {
  BookmarkPlus,
  Download,
  AlertTriangle,
  Package,
  Clock,
  Loader2,
} from "lucide-react";
import type { ChapterTemplate, Game } from "@shared/schema";

interface BaseProps {
  gameId: string;
  open: boolean;
  onClose: () => void;
}

type DialogMode =
  | { mode: "save"; chapterId: string; chapterTitle: string }
  | { mode: "import" };

interface ChapterTemplatesDialogProps extends BaseProps {
  mode: DialogMode;
}

export function ChapterTemplatesDialog({
  gameId,
  mode,
  open,
  onClose,
}: ChapterTemplatesDialogProps) {
  if (mode.mode === "save") {
    return (
      <SaveTemplateDialog
        gameId={gameId}
        chapterId={mode.chapterId}
        chapterTitle={mode.chapterTitle}
        open={open}
        onClose={onClose}
      />
    );
  }
  return <ImportTemplateDialog gameId={gameId} open={open} onClose={onClose} />;
}

// ============================================================================
// 存成模板
// ============================================================================

function SaveTemplateDialog({
  gameId: _gameId,
  chapterId,
  chapterTitle,
  open,
  onClose,
}: {
  gameId: string;
  chapterId: string;
  chapterTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(chapterTitle);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/chapters/${chapterId}/save-as-template`,
        {
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 章節已存為模板", description: "其他遊戲可從模板匯入此章節" });
      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: "儲存失敗",
        description: err.message || "請確認遊戲已歸屬場域",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5" />
            存成章節模板
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">模板標題</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="模板的顯示名稱"
              data-testid="input-template-title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">描述（選填）</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述此模板用途、適合的遊戲類型"
              rows={3}
              data-testid="input-template-description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">分類（選填）</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例：新手教學、戰鬥、劇情、結局"
              data-testid="input-template-category"
            />
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>• 模板會複製此章節的所有頁面（獨立副本）</p>
            <p>• 匯入到其他遊戲時，<strong>道具會依 slug 自動對應</strong>，地點/章節引用需手動重設</p>
            <p>• 模板屬於場域層級，場域內所有遊戲可重用</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending}
            data-testid="button-confirm-save-template"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            確認存成模板
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// 從模板匯入
// ============================================================================

function ImportTemplateDialog({
  gameId,
  open,
  onClose,
}: {
  gameId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    chapter: { id: string; title: string };
    pagesCreated: number;
    needsManualReconfigure: Array<{
      pageId: string;
      pageOrder: number;
      missingReferences: Array<{ type: string; id: string; slug?: string }>;
    }>;
  } | null>(null);

  // 先拿 game 資料 → 得到 fieldId
  const { data: game } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
  });

  // 拉場域內所有模板
  const fieldId = game?.fieldId;
  const { data: templates = [], isLoading } = useQuery<ChapterTemplate[]>({
    queryKey: ["/api/admin/fields", fieldId, "chapter-templates"],
    queryFn: () =>
      fetchWithAdminAuth(`/api/admin/fields/${fieldId}/chapter-templates`),
    enabled: !!fieldId && open,
  });

  const importMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/chapter-templates/${templateId}/import`,
        { targetGameId: gameId, remapItemsBySlug: true },
      );
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "chapters"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "pages"],
      });
      toast({ title: `✅ 章節已匯入（${data.pagesCreated} 個頁面）` });
    },
    onError: (err: Error) => {
      toast({
        title: "匯入失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 匯入完成 → 顯示 diff 報告
  if (importResult) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>✅ 匯入完成</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p>
              已建立章節「<strong>{importResult.chapter.title}</strong>」，共{" "}
              {importResult.pagesCreated} 個頁面。
            </p>

            {importResult.needsManualReconfigure.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  有 {importResult.needsManualReconfigure.length} 個頁面需要手動重設
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {importResult.needsManualReconfigure.map((p) => (
                    <div
                      key={p.pageId}
                      className="text-xs bg-white dark:bg-background rounded p-2 border"
                    >
                      <div className="font-medium">第 {p.pageOrder} 頁</div>
                      <ul className="text-muted-foreground mt-1 space-y-0.5">
                        {p.missingReferences.map((ref, i) => (
                          <li key={i}>
                            需重設 {getRefTypeLabel(ref.type)}
                            {ref.slug ? `（原 slug: ${ref.slug}）` : `（原 id: ${ref.id}）`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  請到「頁面編輯器」裡重新選擇對應的道具 / 地點 / 章節。
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                ✨ 所有引用皆已自動對應，無需手動調整！
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={onClose}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            從章節模板匯入
          </DialogTitle>
        </DialogHeader>

        {!fieldId ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            此遊戲未歸屬場域，無法使用模板功能。
          </div>
        ) : isLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            場域內尚無章節模板。
            <br />
            請先在其他章節按「存成模板」按鈕建立模板。
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templates.map((tpl) => {
              const pagesCount = Array.isArray(tpl.pagesSnapshot)
                ? (tpl.pagesSnapshot as unknown[]).length
                : 0;
              return (
                <Card
                  key={tpl.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplateId === tpl.id
                      ? "ring-2 ring-primary"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  data-testid={`card-template-${tpl.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{tpl.title}</div>
                        {tpl.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {tpl.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            <Package className="w-3 h-3 mr-1" />
                            {pagesCount} 頁
                          </Badge>
                          {tpl.category && (
                            <Badge variant="outline" className="text-xs">
                              {tpl.category}
                            </Badge>
                          )}
                          {tpl.estimatedTime && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              約 {tpl.estimatedTime} 分鐘
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() =>
              selectedTemplateId && importMutation.mutate(selectedTemplateId)
            }
            disabled={!selectedTemplateId || importMutation.isPending}
            data-testid="button-confirm-import-template"
          >
            {importMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            匯入章節
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getRefTypeLabel(type: string): string {
  switch (type) {
    case "location":
      return "地點";
    case "item":
      return "道具";
    case "chapter":
      return "章節";
    case "achievement":
      return "成就";
    default:
      return type;
  }
}
