// 元件工具箱側邊欄 - 拖曳頁面類型到編輯器
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Move, Gift } from "lucide-react";
import { PAGE_TYPES, PAGE_TEMPLATES } from "../constants";

interface ToolboxSidebarProps {
  readonly onDragStart: (e: React.DragEvent, pageType: string) => void;
  readonly onDragEnd: () => void;
  readonly onAddTemplate: (templateId: string) => void;
}

export default function ToolboxSidebar({
  onDragStart,
  onDragEnd,
  onAddTemplate,
}: ToolboxSidebarProps) {
  return (
    <aside className="w-56 border-r border-border bg-card/50 flex flex-col">
      <Tabs defaultValue="elements" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b">
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
          className="flex-1 overflow-auto p-2 space-y-1 m-0"
        >
          {PAGE_TYPES.map((type) => (
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
          className="flex-1 overflow-auto p-2 space-y-2 m-0"
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
