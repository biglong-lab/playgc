// 頁面列表側邊欄 - 拖曳排序、頁面操作
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Copy, Plus } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "../constants";

interface PageListSidebarProps {
  readonly pages: Page[];
  readonly selectedPage: Page | null;
  readonly isDraggingFromToolbox: boolean;
  readonly dragOverIndex: number | null;
  readonly onSelectPage: (page: Page) => void;
  readonly onReorder: (pages: Page[]) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onDelete: (index: number) => void;
  readonly onDragOver: (e: React.DragEvent, index: number) => void;
  readonly onDrop: (e: React.DragEvent, index: number) => void;
  readonly onDropZoneDrop: (e: React.DragEvent) => void;
}

export default function PageListSidebar({
  pages,
  selectedPage,
  isDraggingFromToolbox,
  dragOverIndex,
  onSelectPage,
  onReorder,
  onDuplicate,
  onDelete,
  onDragOver,
  onDrop,
  onDropZoneDrop,
}: PageListSidebarProps) {
  return (
    <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">頁面流程</h3>
          <p className="text-xs text-muted-foreground">
            {pages.length} 個頁面
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          拖曳排序
        </Badge>
      </div>

      <div
        className="flex-1 overflow-auto p-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropZoneDrop}
      >
        <Reorder.Group
          axis="y"
          values={pages}
          onReorder={onReorder}
          className="space-y-1"
        >
          <AnimatePresence>
            {pages.map((page, index) => {
              const typeInfo = getPageTypeInfo(page.pageType);
              return (
                <div key={page.id}>
                  {dragOverIndex === index && isDraggingFromToolbox && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 40 }}
                      className="border-2 border-dashed border-primary/50 rounded-lg bg-primary/10 flex items-center justify-center text-xs text-primary mb-1"
                    >
                      放置於此
                    </motion.div>
                  )}
                  <Reorder.Item
                    value={page}
                    className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedPage?.id === page.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-background/50 hover:bg-accent border border-transparent"
                    }`}
                    onClick={() => onSelectPage(page)}
                    onDragOver={(e) =>
                      onDragOver(e as unknown as React.DragEvent, index)
                    }
                    onDrop={(e) =>
                      onDrop(e as unknown as React.DragEvent, index)
                    }
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    }}
                    data-testid={`page-item-${index}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${typeInfo.color}`}
                    >
                      <typeInfo.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {typeInfo.label}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        #{index + 1}
                      </p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(index);
                        }}
                        data-testid={`button-duplicate-${index}`}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(index);
                        }}
                        data-testid={`button-delete-${index}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Reorder.Item>
                </div>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>

        {pages.length === 0 && (
          <motion.div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDraggingFromToolbox
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
            animate={{ scale: isDraggingFromToolbox ? 1.02 : 1 }}
          >
            <Plus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              從左側拖曳元件到此處
            </p>
          </motion.div>
        )}

        {pages.length > 0 && isDraggingFromToolbox && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 60 }}
            className="border-2 border-dashed border-primary/50 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary mt-2"
            onDragOver={(e) => e.preventDefault()}
          >
            放置於最後
          </motion.div>
        )}
      </div>
    </aside>
  );
}
