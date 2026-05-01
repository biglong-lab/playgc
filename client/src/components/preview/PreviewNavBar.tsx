// 🎬 預覽模式底部固定導航條
//
// 設計：
//   - 底部 sticky / z-40（低於 Banner 的 z-50）
//   - ⏮ 第一頁 / ◀ 上一頁 / 中間「第 X / Y 頁」可輸入跳頁 / 下一頁 ▶ / ⏭ 最後頁
//   - 不檢查 condition / unlock — 預覽模式自由跳轉（守則 9）
//   - 邊界 disabled：第一頁時 ⏮◀ 禁用、最後頁時 ▶⏭ 禁用
//
// 使用：
//   <PreviewNavBar
//     currentIndex={idx}
//     totalPages={pages.length}
//     onJump={(i) => setIdx(i)}
//   />
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PreviewNavBarProps {
  currentIndex: number;
  totalPages: number;
  onJump: (index: number) => void;
}

export function PreviewNavBar({
  currentIndex,
  totalPages,
  onJump,
}: PreviewNavBarProps) {
  const [jumpInput, setJumpInput] = useState("");

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalPages - 1;

  const handleJump = () => {
    const target = parseInt(jumpInput, 10);
    if (Number.isNaN(target)) return;
    // UI 顯示 1-based，內部 0-based
    const idx = Math.max(0, Math.min(totalPages - 1, target - 1));
    onJump(idx);
    setJumpInput("");
  };

  return (
    <div
      className="sticky bottom-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border"
      data-testid="preview-navbar"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          disabled={isFirst}
          onClick={() => onJump(0)}
          data-testid="button-first-page"
          title="第一頁"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isFirst}
          onClick={() => onJump(currentIndex - 1)}
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          上一頁
        </Button>

        <div className="flex items-center gap-2 px-3">
          <span className="text-sm font-medium tabular-nums">
            第 {currentIndex + 1} / {totalPages} 頁
          </span>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJump();
              }}
              placeholder="跳到"
              className="w-20 h-8 text-xs"
              data-testid="input-jump-page"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={!jumpInput}
              onClick={handleJump}
              className="h-8 px-2 text-xs"
            >
              跳轉
            </Button>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isLast}
          onClick={() => onJump(currentIndex + 1)}
          data-testid="button-next-page"
        >
          下一頁
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isLast}
          onClick={() => onJump(totalPages - 1)}
          data-testid="button-last-page"
          title="最後頁"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
