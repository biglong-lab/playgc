// 遊戲建立/編輯表單對話框
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GameFormData } from "./types";

interface GameFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: GameFormData;
  setFormData: React.Dispatch<React.SetStateAction<GameFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  onReset: () => void;
}

export default function GameFormDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isPending,
  onReset,
}: GameFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onReset()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "編輯遊戲" : "新增遊戲"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "修改遊戲資訊" : "建立新的實境遊戲"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">遊戲名稱 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="輸入遊戲名稱"
                required
                data-testid="input-game-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">遊戲描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="輸入遊戲描述"
                rows={3}
                data-testid="input-game-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="difficulty">難度</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                >
                  <SelectTrigger data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">簡單</SelectItem>
                    <SelectItem value="medium">中等</SelectItem>
                    <SelectItem value="hard">困難</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">預估時間 (分鐘)</Label>
                <Input
                  id="estimatedTime"
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                  placeholder="60"
                  min="1"
                  data-testid="input-estimated-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">最大玩家數</Label>
              <Input
                id="maxPlayers"
                type="number"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                placeholder="6"
                min="1"
                max="100"
                data-testid="input-max-players"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onReset}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-submit-game"
            >
              {isEditing ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
