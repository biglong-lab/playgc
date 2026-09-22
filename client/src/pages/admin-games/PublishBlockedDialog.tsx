// 🚦 發布被擋時的錯誤清單對話框（2026-09-23 P0-B，取代原生 alert）
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
import type { PublishBlocked } from "./usePublishPrecheck";

/** 最多列幾項（其餘顯示「還有 N 項」） */
const MAX_LISTED = 8;

interface PublishBlockedDialogProps {
  blocked: PublishBlocked | null;
  onClose: () => void;
  onOpenEditor: (gameId: string) => void;
}

export function PublishBlockedDialog({ blocked, onClose, onOpenEditor }: PublishBlockedDialogProps) {
  const errors = blocked?.errors ?? [];
  const listed = errors.slice(0, MAX_LISTED);
  const rest = errors.length - listed.length;

  return (
    <AlertDialog open={!!blocked} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent data-testid="dialog-publish-blocked">
        <AlertDialogHeader>
          <AlertDialogTitle>「{blocked?.gameTitle || "此遊戲"}」還不能發布</AlertDialogTitle>
          <AlertDialogDescription>
            發布後玩家馬上就能玩，請先到編輯器修正以下 {errors.length} 個問題：
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc pl-5 space-y-1 text-sm max-h-64 overflow-y-auto">
          {listed.map((e, i) => (
            <li key={`${e.pageId ?? "game"}-${i}`}>{e.message}</li>
          ))}
          {rest > 0 && <li className="text-muted-foreground">…還有 {rest} 個問題</li>}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-publish-blocked-close">關閉</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocked && onOpenEditor(blocked.gameId)}
            data-testid="button-publish-blocked-edit"
          >
            前往編輯器
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
