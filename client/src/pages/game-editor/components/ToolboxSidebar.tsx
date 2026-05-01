// 元件工具箱側邊欄 - 拖曳頁面類型到編輯器
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Move, Gift } from "lucide-react";
import { PAGE_TYPES, PAGE_TEMPLATES } from "../constants";
import { isComponentAllowedForGameMode } from "@shared/multiplayer-component-types";

interface ToolboxSidebarProps {
  readonly onDragStart: (e: React.DragEvent, pageType: string) => void;
  readonly onDragEnd: () => void;
  readonly onAddTemplate: (templateId: string) => void;
  /** 當前遊戲的 gameMode（用於過濾 multi 元件）— 個人遊戲不顯示 multi 專用元件 */
  readonly gameMode?: string | null;
}

export default function ToolboxSidebar({
  onDragStart,
  onDragEnd,
  onAddTemplate,
  gameMode,
}: ToolboxSidebarProps) {
  // 依 gameMode 過濾元件清單
  // - individual → 隱藏 multi 元件
  // - team / competitive / relay → 全部顯示（不對稱規則 v1.2）
  // - 未指定（建立新遊戲時）→ 全部顯示，server 約束會擋下不合規組合
  const visiblePageTypes = useMemo(() => {
    if (!gameMode) return PAGE_TYPES;
    return PAGE_TYPES.filter((type) =>
      isComponentAllowedForGameMode(type.value, gameMode),
    );
  }, [gameMode]);
  return (
    <aside className="w-56 border-r border-border bg-card/50 flex flex-col min-h-0 shrink-0">
      {/* 🔧 Tabs 嵌套 flex 高度鏈：Tabs / TabsContent 都要加 min-h-0 讓 overflow-auto 生效 */}
      <Tabs defaultValue="elements" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full rounded-none border-b shrink-0">
          <TabsTrigger value="elements" className="flex-1 text-xs">
            <Move className="w-3 h-3 mr-1" />
            元件
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1 text-xs">
            <Gift className="w-3 h-3 mr-1" />
            模板
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="elements"
          className="flex-1 overflow-y-auto p-2 space-y-1 m-0 min-h-0"
        >
          {visiblePageTypes.map((type) => (
            <motion.div
              key={type.value}
              draggable
              onDragStart={(e) =>
                onDragStart(e as unknown as React.DragEvent, type.value)
              }
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-grab active:cursor-grabbing ${type.color} border border-transparent hover:border-border/50 transition-all`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid={`toolbox-${type.value}`}
            >
              <type.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{type.label}</span>
            </motion.div>
          ))}
        </TabsContent>

        <TabsContent
          value="templates"
          className="flex-1 overflow-y-auto p-2 space-y-2 m-0 min-h-0"
        >
          {PAGE_TEMPLATES.map((template) => (
            <motion.button
              key={template.id}
              onClick={() => onAddTemplate(template.id)}
              className={`w-full text-left p-2 rounded-lg ${template.color} border border-transparent hover:border-border/50 transition-all`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid={`template-${template.id}`}
            >
              <div className="flex items-center gap-2">
                <template.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{template.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {template.description}
              </p>
            </motion.button>
          ))}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
