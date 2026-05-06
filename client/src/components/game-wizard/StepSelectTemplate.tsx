// 步驟 1：選擇模板
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { GAME_TEMPLATES, type GameTemplate } from "./templates";
import TemplateCard from "./TemplateCard";

interface StepSelectTemplateProps {
  selectedTemplate: GameTemplate | null;
  onSelectTemplate: (template: GameTemplate) => void;
  /** 🆕 軟分流：選擇 game mode 後回退按鈕（activity wizard 沒此步驟、不顯示）*/
  onBack?: () => void;
  /** 🆕 顯示當前選擇的 game mode（提示 user）*/
  selectedGameMode?: "individual" | "team";
}

export default function StepSelectTemplate({
  selectedTemplate,
  onSelectTemplate,
  onBack,
  selectedGameMode,
}: StepSelectTemplateProps) {
  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          選擇一個模板快速開始
        </h2>
        <p className="text-muted-foreground">
          選擇適合的模板，或從空白開始自訂
        </p>
        {selectedGameMode && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs">
            <span>{selectedGameMode === "team" ? "👥 多人協作" : "🧍 個人遊戲"}</span>
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-5 px-1 text-xs"
                data-testid="btn-back-to-game-mode"
              >
                變更
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 模板網格 */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
        data-testid="template-grid"
      >
        {GAME_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplate?.id === template.id}
            onClick={() => onSelectTemplate(template)}
          />
        ))}
      </div>
    </div>
  );
}
