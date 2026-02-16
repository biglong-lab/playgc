// 模組預覽彈窗 - 展示完整模組資訊與頁面流程
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  MODULE_CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type GameModule,
} from "@shared/schema";
import { getPageTypeInfo } from "@/pages/game-editor/constants";
import {
  Clock, Users, FileText, Sparkles,
  ArrowDown, CheckCircle2, Star,
} from "lucide-react";

interface ModulePreviewDialogProps {
  module: GameModule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (module: GameModule) => void;
}

export default function ModulePreviewDialog({
  module,
  open,
  onOpenChange,
  onApply,
}: ModulePreviewDialogProps) {
  if (!module) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{module.coverEmoji}</span>
            <div>
              <div className="text-xl">{module.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {MODULE_CATEGORY_LABELS[module.category]}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {DIFFICULTY_LABELS[module.difficulty]}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5">
            {/* 基本資訊 */}
            <p className="text-sm text-muted-foreground">{module.description}</p>

            <div className="grid grid-cols-3 gap-3">
              <InfoCard icon={<Clock className="w-4 h-4" />} label="預估時間" value={`${module.estimatedTime ?? "?"} 分鐘`} />
              <InfoCard icon={<Users className="w-4 h-4" />} label="最大人數" value={`${module.maxPlayers} 人`} />
              <InfoCard icon={<FileText className="w-4 h-4" />} label="頁面數" value={`${module.pages.length} 頁`} />
            </div>

            {/* 適用場景 */}
            <div>
              <h4 className="text-sm font-semibold mb-1.5">適用場景</h4>
              <p className="text-sm text-muted-foreground">{module.scenario}</p>
            </div>

            {/* 亮點特色 */}
            <div>
              <h4 className="text-sm font-semibold mb-1.5">亮點特色</h4>
              <ul className="space-y-1">
                {module.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Star className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* 頁面流程 */}
            <div>
              <h4 className="text-sm font-semibold mb-1.5">遊戲流程</h4>
              <p className="text-xs text-muted-foreground mb-3">{module.flowDescription}</p>

              <div className="space-y-1">
                {module.pages.map((page, idx) => {
                  const typeInfo = getPageTypeInfo(page.pageType);
                  const Icon = typeInfo.icon;
                  const isLast = idx === module.pages.length - 1;

                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
                        {/* 步驟編號 */}
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        {/* pageType 圖示 */}
                        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${typeInfo.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {/* 頁面資訊 */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{page.title}</div>
                          <div className="text-xs text-muted-foreground">{typeInfo.label}</div>
                        </div>
                        {/* 完成圖示 */}
                        {isLast && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                      </div>
                      {/* 箭頭連接 */}
                      {!isLast && (
                        <div className="flex justify-center py-0.5">
                          <ArrowDown className="w-3.5 h-3.5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 標籤 */}
            <div className="flex flex-wrap gap-1.5">
              {module.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
          <Button onClick={() => onApply(module)}>
            <Sparkles className="w-4 h-4 mr-1" />
            從此模組建立遊戲
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 資訊小卡片 */
function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
