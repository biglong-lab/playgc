// 步驟 2：填寫遊戲名稱
import { Map, Puzzle, HelpCircle, Target, Users, Plus, Clock, Users2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GameTemplate } from "./templates";

// 圖示對應表
const ICON_MAP: Record<string, typeof Map> = {
  map: Map,
  puzzle: Puzzle,
  "help-circle": HelpCircle,
  target: Target,
  users: Users,
  plus: Plus,
};

interface StepGameInfoProps {
  template: GameTemplate;
  gameName: string;
  onGameNameChange: (name: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function StepGameInfo({
  template,
  gameName,
  onGameNameChange,
  onBack,
  onSubmit,
  isSubmitting,
}: StepGameInfoProps) {
  const Icon = ICON_MAP[template.icon] || Plus;

  // 取得模板包含的頁面類型摘要
  const getPageSummary = () => {
    if (template.pages.length === 0) {
      return "自由設計，無預設頁面";
    }
    const pageTypes = template.pages.map((p) => p.title);
    return pageTypes.join(" → ");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameName.trim()) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 模板資訊 */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
      </div>

      {/* 遊戲名稱輸入 */}
      <div className="space-y-2">
        <Label htmlFor="game-name" className="text-base">
          為你的遊戲取個名字 *
        </Label>
        <Input
          id="game-name"
          value={gameName}
          onChange={(e) => onGameNameChange(e.target.value)}
          placeholder="例如：台北大冒險"
          className="text-lg py-6"
          autoFocus
          required
          data-testid="input-game-name"
        />
      </div>

      {/* 模板詳情 */}
      {template.id !== "blank" && (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-primary">✨</span>
            <span>模板包含：{getPageSummary()}</span>
          </div>
          {template.estimatedTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>預估時間：{template.estimatedTime} 分鐘</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users2 className="w-4 h-4" />
            <span>適合人數：1-{template.maxPlayers} 人</span>
          </div>
        </div>
      )}

      {/* 提示 */}
      <p className="text-sm text-muted-foreground text-center">
        💡 建立後可以隨時修改內容
      </p>

      {/* 按鈕 */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          data-testid="button-back"
        >
          返回
        </Button>
        <Button
          type="submit"
          disabled={!gameName.trim() || isSubmitting}
          data-testid="button-create-game"
        >
          {isSubmitting ? "建立中..." : "建立遊戲 →"}
        </Button>
      </div>
    </form>
  );
}
