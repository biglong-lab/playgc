// 🧑‍🎮 匿名玩家自訂暱稱 Dialog
//
// 觸發時機：
//   - 進入遊戲前，偵測使用者是匿名登入（無 firstName/lastName，email 是 @firebase.local）
//   - 該 session 尚未設定 playerName
//
// UI 要素：
//   - 友善的引導文案
//   - 暱稱輸入框（2-20 字）
//   - ⚠️ 警示：匿名遊玩不累積積分到個人帳號
//   - [登入 Google] 按鈕（切到正式帳號）
//   - [直接開始] 按鈕（保持匿名）

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, AlertTriangle, LogIn, Play } from "lucide-react";
import { validatePlayerName } from "@shared/lib/playerDisplay";
import { useToast } from "@/hooks/use-toast";

interface AnonymousNameDialogProps {
  open: boolean;
  /** 使用者按「直接開始」時呼叫，帶入暱稱 */
  onConfirm: (name: string) => void;
  /** 使用者按「登入 Google」時呼叫 */
  onGoogleLogin?: () => void;
  /** 使用者關閉 Dialog（用 X 或 Esc） */
  onClose?: () => void;
  /** 預設暱稱（若先前有設過） */
  initialName?: string;
  /** 若為 true 則強制必填，不提供關閉 */
  forceInput?: boolean;
}

export function AnonymousNameDialog({
  open,
  onConfirm,
  onGoogleLogin,
  onClose,
  initialName = "",
  forceInput = false,
}: AnonymousNameDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setSubmitting(false);
    }
  }, [open, initialName]);

  const handleSubmit = () => {
    const result = validatePlayerName(name);
    if (!result.valid) {
      toast({
        title: "暱稱格式錯誤",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    onConfirm(result.value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !forceInput) onClose?.();
      }}
    >
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => {
          if (forceInput) e.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mx-auto mb-2">
            <User className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            給自己取個暱稱吧！
          </DialogTitle>
          <DialogDescription className="text-center">
            你目前用匿名模式進入遊戲，幫自己取個名字，
            <br />
            排行榜和場次紀錄才不會都顯示「玩家」
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">遊戲暱稱</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：小明、大雄、隊長..."
              maxLength={20}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleSubmit();
              }}
              data-testid="input-anonymous-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              2-20 個字，可使用中英文、數字
            </p>
          </div>

          {/* ⚠️ 匿名積分警告 */}
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                匿名遊玩不累積積分
              </span>
              <br />
              <span className="text-muted-foreground">
                想把分數記到個人帳號、跨場次累計成就？請改用 Google 登入。
              </span>
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {onGoogleLogin && (
            <Button
              variant="outline"
              onClick={onGoogleLogin}
              className="flex-1 gap-2"
              data-testid="button-google-login"
            >
              <LogIn className="w-4 h-4" />
              改用 Google 登入
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="flex-1 gap-2"
            data-testid="button-confirm-name"
          >
            <Play className="w-4 h-4" />
            {submitting ? "設定中..." : "直接開始"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
