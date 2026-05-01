// 👑 LeaderDecideDialog — 隊長收到隊員寬限期過時顯示「等待 / 先繼續」決定
//
// 觸發時機：useTeamLobby / GamePlay 收到 onGraceExpired callback 時
//   若 myMembership.role === "leader" 或 team.leaderId === user.id → 設 pendingDecision
//   非隊長收到 → 顯示 toast「等隊長決定」（不開 dialog）
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §11 Phase 2.5 暫緩項
//
// API：POST /api/teams/:teamId/leader-decide
//   body: { targetUserId, action: "wait" | "continue" }

import { Button } from "@/components/ui/button";
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
import { Clock, UserX, Hourglass } from "lucide-react";

export interface LeaderDecideDialogProps {
  open: boolean;
  /** 寬限期過的玩家資訊 */
  targetUserName: string | null;
  /** 隊長按「等待」 */
  onWait: () => void;
  /** 隊長按「先繼續」 */
  onContinue: () => void;
  /** 關閉 dialog（取消，不做決定 — 自動 leave timer 仍會觸發） */
  onCancel: () => void;
}

export default function LeaderDecideDialog({
  open,
  targetUserName,
  onWait,
  onContinue,
  onCancel,
}: LeaderDecideDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent data-testid="leader-decide-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-destructive" />
            玩家寬限期已過 — 你要怎麼決定？
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{targetUserName || "某位玩家"}</strong> 已超過 30 秒沒有重新連線。
            你是隊長，可以選擇：
            <br />
            <br />
            <span className="block mb-1">
              <strong>等待</strong>：取消自動踢出計時，繼續等他回來。
            </span>
            <span className="block">
              <strong>先繼續</strong>：立刻將他標為離開，遊戲不被卡住。
            </span>
            <br />
            <span className="text-xs text-muted-foreground">
              不做決定 → 120 秒後系統自動「先繼續」
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={onCancel}
            data-testid="btn-leader-decide-cancel"
          >
            稍後決定
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onWait}
            data-testid="btn-leader-decide-wait"
          >
            <Hourglass className="w-4 h-4 mr-1" />
            等待
          </Button>
          <AlertDialogAction
            onClick={onContinue}
            data-testid="btn-leader-decide-continue"
          >
            <UserX className="w-4 h-4 mr-1" />
            先繼續
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
