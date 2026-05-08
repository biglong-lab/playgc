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
import { Upload } from "lucide-react";
import { useGameMediaUpload } from "@/hooks/useGameMediaUpload";
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
  /** 🆕 D2-c+ (2026-05-09)：編輯模式下傳入 gameId、可上傳 BGM 檔案；新建模式為空 */
  editingGameId?: string | null;
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
  editingGameId,
}: GameFormDialogProps) {
  // 🆕 D2-c+ (2026-05-09)：BGM 檔案上傳支援（編輯模式才能用）
  const { handleUpload, isUploading } = useGameMediaUpload(editingGameId);
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
            {/* 🎮 遊戲類型（影響元件分類約束） */}
            <div className="space-y-2">
              <Label htmlFor="gameMode">遊戲類型 *</Label>
              <Select
                value={formData.gameMode}
                onValueChange={(value) => setFormData({ ...formData, gameMode: value })}
              >
                <SelectTrigger data-testid="select-game-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">🧍 個人遊戲（玩家獨立完成）</SelectItem>
                  <SelectItem value="team">👥 隊伍協作（共同進度）</SelectItem>
                  <SelectItem value="competitive">⚔️ 競技對戰（隊伍 PVP）</SelectItem>
                  <SelectItem value="relay">🏃 接力任務（順序解鎖）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                個人遊戲只能使用個人元件；多人遊戲（隊伍/競技/接力）可額外使用多人專用元件
              </p>
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

          {/* 🆕 2026-05-07 BGM：整場背景音樂 URL */}
          {/* 🆕 D2-c+ (2026-05-09)：編輯模式可上傳檔案、新建模式只能 URL */}
          <div className="space-y-2 pt-3 border-t">
            <Label htmlFor="bgmUrl" className="flex items-center gap-1">
              🎵 整場 BGM 音樂網址
              <span className="text-xs text-muted-foreground font-normal">（選填）</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="bgmUrl"
                type="url"
                value={formData.bgmUrl}
                onChange={(e) => setFormData({ ...formData, bgmUrl: e.target.value })}
                placeholder="https://res.cloudinary.com/.../audio.mp3"
                data-testid="input-bgm-url"
                className="flex-1"
              />
              {/* 編輯模式才顯示上傳按鈕（需要 gameId） */}
              {isEditing && editingGameId && (
                <>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    id="bgm-file-upload"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = await handleUpload(file, "audio");
                        if (url) setFormData({ ...formData, bgmUrl: url });
                      }
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isUploading}
                    onClick={() => document.getElementById("bgm-file-upload")?.click()}
                    data-testid="button-upload-bgm"
                    title="上傳音訊檔（≤ 30MB）"
                  >
                    {isUploading ? <span className="animate-spin">⏳</span> : <Upload className="w-4 h-4" />}
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              玩家進場自動播放、影片元件時自動減弱、玩家可手動靜音
              {!isEditing && " · 上傳檔案請先儲存遊戲、再回編輯模式"}
            </p>
            {formData.bgmUrl && (
              <audio
                controls
                src={formData.bgmUrl}
                className="w-full mt-2"
                preload="none"
                data-testid="audio-bgm-preview"
              />
            )}
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
