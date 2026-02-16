import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Save, Loader2 } from "lucide-react";
import {
  ACHIEVEMENT_TYPES, RARITY_TYPES, ACHIEVEMENT_ICONS,
  getRarityInfo,
  type AchievementFormData,
} from "./constants";

interface AchievementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: AchievementFormData;
  onFormDataChange: (data: AchievementFormData) => void;
  onSave: () => void;
  isCreating: boolean;
  isSaving: boolean;
}

export function AchievementFormDialog({
  open, onOpenChange,
  formData, onFormDataChange,
  onSave, isCreating, isSaving,
}: AchievementFormDialogProps) {

  const handleRarityChange = (value: string) => {
    const rarityInfo = getRarityInfo(value);
    onFormDataChange({ ...formData, rarity: value, points: rarityInfo.points });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreating ? "新增成就" : "編輯成就"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 名稱 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">成就名稱</label>
            <Input
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="輸入成就名稱"
              data-testid="input-achievement-name"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <Textarea
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="輸入成就描述"
              rows={2}
              data-testid="input-achievement-description"
            />
          </div>

          {/* 類型 + 稀有度 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">成就類型</label>
              <Select
                value={formData.achievementType}
                onValueChange={(value) => onFormDataChange({ ...formData, achievementType: value })}
              >
                <SelectTrigger data-testid="select-achievement-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACHIEVEMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">稀有度</label>
              <Select value={formData.rarity} onValueChange={handleRarityChange}>
                <SelectTrigger data-testid="select-achievement-rarity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RARITY_TYPES.map((rarity) => (
                    <SelectItem key={rarity.value} value={rarity.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${rarity.color}`} />
                        <span>{rarity.label}</span>
                        <span className="text-muted-foreground text-xs">({rarity.points}點)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 點數 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">獎勵點數</label>
            <Input
              type="number"
              value={formData.points}
              onChange={(e) => onFormDataChange({ ...formData, points: parseInt(e.target.value) || 0 })}
              placeholder="輸入點數"
              data-testid="input-achievement-points"
            />
          </div>

          {/* 圖示 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">圖示</label>
            <div className="grid grid-cols-5 gap-2">
              {ACHIEVEMENT_ICONS.map((icon) => (
                <button
                  key={icon.value}
                  type="button"
                  className={`p-3 rounded-lg border transition-colors ${
                    formData.iconUrl === icon.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => onFormDataChange({ ...formData, iconUrl: icon.value })}
                  title={icon.label}
                  data-testid={`button-icon-${icon.value}`}
                >
                  <icon.icon className="w-5 h-5 mx-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* 隱藏成就 */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium text-sm">隱藏成就</p>
              <p className="text-xs text-muted-foreground">解鎖前不會顯示給玩家</p>
            </div>
            <Switch
              checked={formData.isHidden}
              onCheckedChange={(checked) => onFormDataChange({ ...formData, isHidden: checked })}
              data-testid="switch-hidden"
            />
          </div>

          {/* 解鎖條件 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">解鎖條件類型</label>
            <Select
              value={formData.condition.type}
              onValueChange={(value) => onFormDataChange({
                ...formData,
                condition: { ...formData.condition, type: value },
              })}
            >
              <SelectTrigger data-testid="select-condition-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visit_location">到達地點</SelectItem>
                <SelectItem value="collect_items">收集道具</SelectItem>
                <SelectItem value="complete_mission">完成任務</SelectItem>
                <SelectItem value="score_threshold">達到分數</SelectItem>
                <SelectItem value="time_limit">時間限制</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.condition.type === "score_threshold" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">目標分數</label>
              <Input
                type="number"
                value={formData.condition.count || 0}
                onChange={(e) => onFormDataChange({
                  ...formData,
                  condition: { ...formData.condition, count: parseInt(e.target.value) || 0 },
                })}
                placeholder="輸入目標分數"
                data-testid="input-condition-count"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={onSave} disabled={!formData.name || isSaving} data-testid="button-save-achievement">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {isCreating ? "創建" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
