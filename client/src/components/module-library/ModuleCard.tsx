// 遊戲模組卡片元件 - 展示模組基本資訊
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  MODULE_CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type GameModule,
} from "@shared/schema";
import { Clock, Users, FileText, Eye, Sparkles } from "lucide-react";

interface ModuleCardProps {
  module: GameModule;
  onPreview: (module: GameModule) => void;
  onApply: (module: GameModule) => void;
}

/** 難度對應的 badge 樣式 */
function getDifficultyVariant(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "hard":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export default function ModuleCard({ module, onPreview, onApply }: ModuleCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/50 flex flex-col">
      <CardHeader className="pb-3">
        {/* 封面 emoji + 分類標籤 */}
        <div className="flex items-start justify-between">
          <div className="text-4xl">{module.coverEmoji}</div>
          <Badge variant="outline" className="text-xs">
            {MODULE_CATEGORY_LABELS[module.category]}
          </Badge>
        </div>

        {/* 模組名稱 */}
        <h3 className="font-bold text-lg mt-2 group-hover:text-primary transition-colors">
          {module.name}
        </h3>

        {/* 描述 */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {module.description}
        </p>
      </CardHeader>

      <CardContent className="pb-3 flex-1">
        {/* 數據指標 */}
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{module.estimatedTime ?? "?"} 分鐘</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{module.maxPlayers} 人</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>{module.pages.length} 頁</span>
          </div>
        </div>

        {/* 難度 + 標籤 */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge className={getDifficultyVariant(module.difficulty)}>
            {DIFFICULTY_LABELS[module.difficulty] ?? module.difficulty}
          </Badge>
          {module.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onPreview(module)}
        >
          <Eye className="w-4 h-4 mr-1" />
          預覽
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onApply(module)}
        >
          <Sparkles className="w-4 h-4 mr-1" />
          套用
        </Button>
      </CardFooter>
    </Card>
  );
}
