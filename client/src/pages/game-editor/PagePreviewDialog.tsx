// 🎨 G1: 遊戲編輯器每元件預覽 Dialog
// 讓管理員不用發布遊戲就能看 player-side 渲染效果
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Eye, ArrowRight } from "lucide-react";
import type { Page } from "@shared/schema";
import GamePageRenderer from "@/components/game/GamePageRenderer";
import { useToast } from "@/hooks/use-toast";

interface PagePreviewDialogProps {
  page: Page | null;
  onClose: () => void;
  /** 🆕 真實 gameId（讓 AI 評分等 API 能找到對應場域的 API key）*/
  gameId?: string;
  /** 🆕 全部頁面（讓預覽能顯示「會跳到哪一頁」）*/
  allPages?: Page[];
}

export default function PagePreviewDialog({ page, onClose, gameId, allPages }: PagePreviewDialogProps) {
  const { toast } = useToast();
  if (!page) return null;

  // 預覽模式的 mock props — 顯示跳轉目標讓 admin 驗證設定
  // 不實際導航（避免污染 admin 編輯狀態），但用 toast 顯示「將跳到 #X 頁名」
  const mockHandlers = {
    onComplete: (_reward?: unknown, nextPageId?: string) => {
      if (nextPageId && allPages) {
        const target = allPages.find((p) => p.id === nextPageId);
        if (target) {
          const idx = allPages.indexOf(target) + 1;
          const name = target.customName || target.pageType;
          toast({
            title: "✅ 跳轉預覽",
            description: `將跳至 #${idx} ${name}`,
          });
          return;
        }
      }
      // 無指定 nextPageId → 預設「下一頁」
      toast({
        title: "▶️ 完成此頁",
        description: nextPageId ? `跳至頁面 ID: ${nextPageId}（找不到對應頁面）` : "預設行為：下一頁",
      });
    },
    onVariableUpdate: () => {
      /* preview mode — no-op */
    },
  };

  return (
    <Dialog open={!!page} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl h-[85vh] p-0 overflow-hidden flex flex-col"
        data-testid="page-preview-dialog"
      >
        <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <DialogTitle className="text-base truncate">
                預覽：{page.pageType}
              </DialogTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="shrink-0"
              data-testid="button-close-preview"
            >
              <X className="w-4 h-4 mr-1" />
              結束預覽
            </Button>
          </div>
          <DialogDescription className="text-xs">
            預覽模式 · 答題、分數、進度都不會被記錄 · 跳轉會以 toast 顯示
            <ArrowRight className="inline w-3 h-3 mx-1" />
            音訊請點擊頁面任意處啟動
          </DialogDescription>
        </DialogHeader>

        {/* 預覽 container — 模擬手機尺寸 */}
        {/* 🎯 2026-05-05 設計原則：預覽 = 實際 100% 一樣（不拆分、確保 admin 真實測試） */}
        <div className="flex-1 overflow-auto bg-background">
          <div className="min-h-full">
            <GamePageRenderer
              page={page}
              onComplete={mockHandlers.onComplete}
              onVariableUpdate={mockHandlers.onVariableUpdate}
              sessionId="preview-session"
              // 🔑 傳真實 gameId 才能讓 AI 評分 / OCR 找到場域 API key
              // 沒有 gameId 時 fallback 到字串（後端會用全域 key 或回 503）
              gameId={gameId || "preview-game"}
              variables={{}}
              inventory={[]}
              score={0}
              visitedLocations={[]}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
