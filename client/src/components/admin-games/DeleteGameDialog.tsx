// 刪除遊戲確認對話框
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

interface DeleteGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle: string | undefined;
  onConfirm: () => void;
  isPending?: boolean;
}

export default function DeleteGameDialog({
  open,
  onOpenChange,
  gameTitle,
  onConfirm,
  isPending,
}: DeleteGameDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定要刪除遊戲嗎？</AlertDialogTitle>
          <AlertDialogDescription>
            即將刪除「{gameTitle}」。此操作無法復原，遊戲的所有資料都將被永久刪除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-delete"
          >
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
