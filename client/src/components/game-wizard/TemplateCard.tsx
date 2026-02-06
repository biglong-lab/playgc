// 模板選擇卡片元件
import { Map, Puzzle, HelpCircle, Target, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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

// 難度標籤
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

interface TemplateCardProps {
  template: GameTemplate;
  selected: boolean;
  onClick: () => void;
}

export default function TemplateCard({
  template,
  selected,
  onClick,
}: TemplateCardProps) {
  const Icon = ICON_MAP[template.icon] || Plus;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center p-4 rounded-lg border-2 transition-all",
        "hover:border-primary/50 hover:bg-primary/5",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card"
      )}
      data-testid={`template-card-${template.id}`}
    >
      {/* 圖示 */}
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mb-3",
          selected ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <Icon className="w-6 h-6" />
      </div>

      {/* 名稱 */}
      <h3 className="font-medium text-foreground mb-1">{template.name}</h3>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground text-center mb-2 line-clamp-2">
        {template.description}
      </p>

      {/* 資訊標籤 */}
      {template.id !== "blank" && (
        <div className="flex flex-wrap gap-1 justify-center">
          {template.estimatedTime && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              ~{template.estimatedTime} 分鐘
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {DIFFICULTY_LABELS[template.difficulty]}
          </span>
        </div>
      )}
    </button>
  );
}
