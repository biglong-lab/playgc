// ⚠️ DisbandSquadDialog — 解散隊伍前需重新輸入隊名確認（防誤刪）
//
// 設計依據：使用者要求「需要再輸入一次隊伍名稱來避免使用者誤刪」
// 觸發點：SquadSettings 解散按鈕
// 後端 endpoint：DELETE /api/squads/:id

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DisbandSquadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadName: string;
  pending: boolean;
  onConfirm: () => void;
}

export default function DisbandSquadDialog({
  open, onOpenChange, squadName, pending, onConfirm,
}: DisbandSquadDialogProps) {
  const [typed, setTyped] = useState("");
  const matched = typed.trim() === squadName;

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) setTyped("");
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="disband-squad-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            確認解散隊伍
          </DialogTitle>
          <DialogDescription className="space-y-2 mt-2">
            <span className="block">
              此動作將會<strong className="text-destructive">移除隊伍「{squadName}」</strong>、請確認：
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 警告清單 */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1.5 text-destructive">
            <div>⚠️ 隊伍即時解散、所有成員會自動退出</div>
            <div>⚠️ 隊名「{squadName}」將鎖定 180 天無法重複使用</div>
            <div>⚠️ 已累積的戰績仍保留、但無法繼續累積</div>
            <div>⚠️ <strong>此操作無法復原</strong></div>
          </div>

          {/* 重新輸入隊名 */}
          <div className="space-y-2">
            <Label htmlFor="disband-confirm-name">
              請輸入「<span className="font-semibold text-foreground">{squadName}</span>」確認解散
            </Label>
            <Input
              id="disband-confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="輸入隊名"
              autoComplete="off"
              data-testid="input-disband-confirm-name"
              className={matched ? "border-destructive" : ""}
            />
            {typed.length > 0 && !matched && (
              <p className="text-xs text-muted-foreground">
                輸入內容與隊名不符
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleClose(false)}
            disabled={pending}
            data-testid="btn-disband-cancel"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={onConfirm}
            disabled={!matched || pending}
            data-testid="btn-disband-confirm"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            確認解散
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
