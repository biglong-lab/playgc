// 🎨 G1: 遊戲編輯器每元件預覽 Dialog
// 讓管理員不用發布遊戲就能看 player-side 渲染效果
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";
import type { Page } from "@shared/schema";
import GamePageRenderer from "@/components/game/GamePageRenderer";

interface PagePreviewDialogProps {
  page: Page | null;
  onClose: () => void;
  /** 🆕 真實 gameId（讓 AI 評分等 API 能找到對應場域的 API key）*/
  gameId?: string;
}

export default function PagePreviewDialog({ page, onClose, gameId }: PagePreviewDialogProps) {
  if (!page) return null;

  // 預覽模式的 mock props — 提供安全的預設值讓元件能渲染
  // onComplete / onVariableUpdate 都是 no-op（預覽不產生實際副作用）
  const mockHandlers = {
    onComplete: () => {
      /* preview mode — no-op */
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
            預覽模式 · 答題、分數、進度都不會被記錄
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
