// 💝 KeepSquadDialog — 把臨時 team 升級為永久 Squad（「保留下次再用」）
//
// 設計依據：docs/changes/2026-05-04-team-flow-redesign.md
// 觸發點：TeamLobbyView 中 isLeader && !team.squadId 時顯示「保留為長期隊伍」按鈕
// 後端 endpoint：POST /api/teams/:teamId/promote-to-squad

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";

interface KeepSquadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  pending: boolean;
  onConfirm: (data: { name: string; tag?: string; primaryColor?: string }) => void;
}

export default function KeepSquadDialog({
  open, onOpenChange, defaultName = "", pending, onConfirm,
}: KeepSquadDialogProps) {
  const [name, setName] = useState(defaultName);
  const [tag, setTag] = useState("");

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm({
      name: name.trim().slice(0, 50),
      tag: tag.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="keep-squad-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            保留隊伍下次再用？
          </DialogTitle>
          <DialogDescription>
            把這隊伍升級為「長期隊伍」、下次進活動可直接點選使用、戰績也會持續累積到這隊伍名下。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="keep-squad-name">隊伍名稱（必填）</Label>
            <Input
              id="keep-squad-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="例如：公司勇者隊"
              data-testid="input-squad-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keep-squad-tag">TAG（選填、2-10 字、預設取名稱前 4 字）</Label>
            <Input
              id="keep-squad-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="例如：HERO"
              data-testid="input-squad-tag"
              className="uppercase"
            />
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
            💡 <strong>不保留</strong>：這場玩完隊伍就解散、戰績只算這場、其他人之後找不到這隊。
            <br />
            💝 <strong>保留</strong>：下次進活動看到「用此隊伍出戰」按鈕、3 秒組隊完成。
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            data-testid="btn-keep-cancel"
          >
            ❌ 不保留
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleConfirm}
            disabled={!name.trim() || pending}
            data-testid="btn-keep-confirm"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            ✅ 保留隊伍
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
