// 🔁 重新開始確認（2026-09-22 開局減法）
// 原本有進度時進場就整頁蓋「繼續 / 重新開始」框；現在預設直接接續，
// 只有玩家主動按「重新開始」（會清掉進度）才需要這一步確認。
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

interface RestartConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function RestartConfirmDialog({ open, onOpenChange, onConfirm }: RestartConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>重新開始這場遊戲？</AlertDialogTitle>
          <AlertDialogDescription>
            目前的進度與道具會清除，從第 1 關開始。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-restart-cancel">繼續目前進度</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="button-restart-confirm">
            重新開始
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
