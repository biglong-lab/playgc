// 🎚️ 元件開關確認框（2026-09-23 P0-B）：寫明影響範圍才送出，取代直接生效
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
import { describeImpact, pendingScope, pendingTitle, type PendingFlagAction } from "./flag-scope";

interface FlagConfirmDialogProps {
  pending: PendingFlagAction | null;
  fieldName: string | undefined;
  onCancel: () => void;
  onConfirm: (action: PendingFlagAction) => void;
}

export function FlagConfirmDialog({ pending, fieldName, onCancel, onConfirm }: FlagConfirmDialogProps) {
  const isGlobal = pending ? pendingScope(pending) === "global" : false;

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent data-testid="dialog-flag-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{pending ? pendingTitle(pending) : ""}</AlertDialogTitle>
          <AlertDialogDescription className={isGlobal ? "text-destructive font-medium" : undefined}>
            {pending ? describeImpact(pendingScope(pending), fieldName) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="btn-flag-cancel">取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => pending && onConfirm(pending)}
            className={isGlobal ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            data-testid="btn-flag-confirm"
          >
            確認
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
