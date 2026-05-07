// 🔄 ResumeDialog — 進場時的「繼續/重新開始」對話框
// 2026-05-07：玩家進入有既有進度的遊戲、不再自動繼續、讓使用者主動選
//
// 流程：
//   1. useSessionManager 偵測 existingSession → 自動 restoreSession 並 setHasRestoredProgress(true)
//   2. GamePlay 看 hasRestoredProgress 變 true 且 currentPageIndex > 0 → 顯示此 dialog
//   3. user 選「繼續」→ 關 dialog（state 已是 restored）
//      user 選「重新開始」→ 二次確認 → resetAndCreateNew

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, ArrowRight, AlertTriangle } from "lucide-react";

export interface ResumeDialogProps {
  open: boolean;
  onContinue: () => void;
  onReset: () => void;
  /** 上次玩到第幾頁（顯示用、非必要）*/
  currentPageIndex: number;
  /** 總頁數 */
  totalPages: number;
  /** 已得分數 */
  score: number;
}

export default function ResumeDialog({
  open,
  onContinue,
  onReset,
  currentPageIndex,
  totalPages,
  score,
}: ResumeDialogProps) {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  return (
    <>
      {/* 主對話框 */}
      <AlertDialog open={open && !showConfirmReset}>
        <AlertDialogContent
          data-testid="resume-dialog"
          // 不允許點背景關閉、必須選擇
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              偵測到上次進度
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                上次玩到第 <span className="font-bold">{currentPageIndex + 1}</span>
                {" / "}{totalPages} 頁、目前分數 <span className="font-bold">{score}</span> 分
              </span>
              <span className="block text-xs text-muted-foreground">
                可選擇繼續或重新開始（重新開始會清除進度）
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmReset(true)}
              className="gap-1.5 w-full sm:w-auto"
              data-testid="btn-resume-restart"
            >
              <RotateCcw className="w-4 h-4" />
              重新開始
            </Button>
            <Button
              onClick={onContinue}
              className="gap-1.5 w-full sm:w-auto"
              data-testid="btn-resume-continue"
            >
              <ArrowRight className="w-4 h-4" />
              繼續遊戲
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 二次確認重新開始 */}
      <AlertDialog open={open && showConfirmReset}>
        <AlertDialogContent data-testid="resume-dialog-confirm-reset">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              確定要重新開始？
            </AlertDialogTitle>
            <AlertDialogDescription>
              所有已完成的關卡進度、累積分數、收集的道具都會清除、無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowConfirmReset(false)}
              data-testid="btn-resume-cancel-reset"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmReset(false);
                onReset();
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="btn-resume-confirm-reset"
            >
              確定重新開始
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
