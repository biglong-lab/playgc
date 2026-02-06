// 步驟 1：選擇模板
import { GAME_TEMPLATES, type GameTemplate } from "./templates";
import TemplateCard from "./TemplateCard";

interface StepSelectTemplateProps {
  selectedTemplate: GameTemplate | null;
  onSelectTemplate: (template: GameTemplate) => void;
}

export default function StepSelectTemplate({
  selectedTemplate,
  onSelectTemplate,
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
