// 🧑‍🎮 訪客改暱稱 Dialog
//
// 2026-09-22 玩家動線優化：訪客進場時已自動取名（例如「探險家4271」），
// 不再於進遊戲前攔截；此 Dialog 只在玩家主動點大廳的名字時開啟。
// 正式帳號登入改到遊戲結束時引導（結算頁「保存這次紀錄」，紀錄可認領）。

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Check } from "lucide-react";
import { validatePlayerName } from "@shared/lib/playerDisplay";
import { useToast } from "@/hooks/use-toast";

interface AnonymousNameDialogProps {
  open: boolean;
  /** 使用者按「儲存」時呼叫，帶入暱稱 */
  onConfirm: (name: string) => void;
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
            修改暱稱
          </DialogTitle>
          <DialogDescription className="text-center">
            排行榜和隊友會看到這個名字
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
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="flex-1 gap-2"
            data-testid="button-confirm-name"
          >
            <Check className="w-4 h-4" />
            {submitting ? "儲存中..." : "儲存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
