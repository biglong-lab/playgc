// 🎬 預覽模式頂部固定提示橫幅
//
// 設計：
//   - 頂部 sticky banner（z-index 高，不被遊戲畫面蓋住）
//   - amber 警告色（與其他 banner 區隔）
//   - 顯示遊戲名 + 預覽提示 + AI mock 警告 + 退出按鈕
//
// 使用：
//   <PreviewBanner gameTitle={game.title} onExit={() => setLocation(`/admin/games/${gameId}`)} />
import { Button } from "@/components/ui/button";
import { X, Eye } from "lucide-react";

// 📋 AI 實測清單（in-app 路由）
const AI_TEST_CHECKLIST_URL = "/admin/ai-test-checklist";

interface PreviewBannerProps {
  gameTitle: string;
  onExit: () => void;
}

export function PreviewBanner({ gameTitle, onExit }: PreviewBannerProps) {
  return (
    <div
      className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 dark:bg-amber-600/95 dark:text-amber-50 backdrop-blur-sm border-b border-amber-700"
      data-testid="preview-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <Eye className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            <span>🎬 預覽模式</span>
            <span className="font-normal opacity-80">·</span>
            <span className="truncate">{gameTitle}</span>
          </div>
          <div className="text-xs opacity-90 flex items-center gap-2 flex-wrap mt-0.5">
            <span>不會記錄玩家資料</span>
            <span>·</span>
            <span>可自由翻頁</span>
            <span>·</span>
            <span className="font-medium">⚠️ AI 任務已 mock，上線後請實機測試</span>
            <a
              href={AI_TEST_CHECKLIST_URL}
              target="_blank"
              className="inline-flex items-center gap-1 underline font-medium hover:opacity-100 opacity-90"
              data-testid="link-test-checklist"
            >
              📋 實測清單
            </a>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onExit}
          className="flex-shrink-0 hover:bg-amber-600/30 dark:hover:bg-amber-500/30"
          data-testid="button-exit-preview"
        >
          <X className="w-4 h-4 mr-1" />
          退出預覽
        </Button>
      </div>
    </div>
  );
}
