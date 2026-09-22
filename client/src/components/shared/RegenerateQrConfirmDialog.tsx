// 🔁 重新產生 QR / 短連結確認框（共用：遊戲管理 QR 對話框、QR 管理頁）
// 危險操作 L2（影響他人）：舊連結與已印出的 QR 會失效 → 必須明確確認、寫明影響範圍
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

interface RegenerateQrConfirmDialogProps {
  readonly open: boolean;
  readonly gameTitle: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export default function RegenerateQrConfirmDialog({
  open,
  gameTitle,
  onOpenChange,
  onConfirm,
}: RegenerateQrConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定重新產生「{gameTitle}」的 QR Code？</AlertDialogTitle>
          <AlertDialogDescription>
            重新產生後舊連結會作廢，已印出的 QR 會失效（含已張貼、已發出的 QR Code），玩家掃描會找不到遊戲，需重新列印。此動作無法復原。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-regenerate">取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="button-confirm-regenerate">
            確定重新產生
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
