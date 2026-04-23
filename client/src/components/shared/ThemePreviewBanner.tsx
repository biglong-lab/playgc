// 🎨 主題預覽橫幅
//
// 當 URL 有 ?themePreview= 參數時，頁面頂部顯示明顯的橫條提示
// 管理員點「離開預覽」可回到正常主題（清掉 query 後 reload）
import { Eye, X } from "lucide-react";
import { usePreviewTheme, clearPreviewQuery } from "@/providers/FieldThemeProvider";

export function ThemePreviewBanner() {
  const previewTheme = usePreviewTheme();
  if (!previewTheme) return null;

  return (
    <div
      className="sticky top-0 z-[1200] w-full bg-amber-500 text-white text-sm shadow-lg"
      data-testid="theme-preview-banner"
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 shrink-0" />
          <span className="font-medium truncate">
            🎨 主題預覽模式（尚未套用到正式場域）
          </span>
          <span className="hidden sm:inline text-xs opacity-90 shrink-0">
            · 關閉此分頁或點右側「離開」即可回到正常
          </span>
        </div>
        <button
          type="button"
          onClick={clearPreviewQuery}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/20 transition-colors shrink-0"
          data-testid="button-exit-preview"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">離開預覽</span>
        </button>
      </div>
    </div>
  );
}
