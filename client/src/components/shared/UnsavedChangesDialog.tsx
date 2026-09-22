// 🛡️ 未儲存變更對話框 — 搭配 useUnsavedChangesGuard：儲存後離開 / 不存離開 / 取消
//
// 刻意不用 AlertDialogAction（點了會自動關閉）：儲存中要能維持開啟並顯示進度，
// 存檔失敗時也要留著讓使用者改選其他選項。
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { UnsavedChangesGuard } from "@/hooks/useUnsavedWarning";

interface UnsavedChangesDialogProps {
  guard: UnsavedChangesGuard;
  /** 說明文字（預設：離開後這次編輯的內容會遺失） */
  description?: string;
}

export default function UnsavedChangesDialog({ guard, description }: UnsavedChangesDialogProps) {
  const { pendingTo, isSaving, saveAndLeave, leaveWithoutSaving, cancel } = guard;

  return (
    <AlertDialog
      open={pendingTo !== null}
      onOpenChange={(open) => {
        if (!open && !isSaving) cancel();
      }}
    >
      <AlertDialogContent data-testid="dialog-unsaved-changes">
        <AlertDialogHeader>
          <AlertDialogTitle>有未儲存的變更</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? "離開後，這次編輯的內容會遺失。要先儲存再離開嗎？"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isSaving} data-testid="button-cancel-leave">
            取消
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={leaveWithoutSaving}
            disabled={isSaving}
            data-testid="button-leave-without-saving"
          >
            不存離開
          </Button>
          <Button
            onClick={() => void saveAndLeave()}
            disabled={isSaving}
            data-testid="button-save-and-leave"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? "儲存中…" : "儲存後離開"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
