// 頁面列表側邊欄 - 拖曳排序、頁面操作
import { useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Copy, Plus, AlertTriangle } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "../constants";
import { validatePageConfig } from "../lib/validate-page-config";

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
  // 計算每頁有多少錯誤 / 警告
  const issuesByPageId = useMemo(() => {
    const map = new Map<string, { errors: number; warnings: number }>();
    for (const page of pages) {
      const issues = validatePageConfig(page);
      map.set(page.id, {
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
      });
    }
    return map;
  }, [pages]);

  const totalErrors = Array.from(issuesByPageId.values()).reduce(
    (sum, v) => sum + v.errors,
    0,
  );

  return (
    <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-medium text-sm">頁面流程</h3>
          <p className="text-xs text-muted-foreground">
            {pages.length} 個頁面{totalErrors > 0 && (
              <span className="text-destructive ml-1">· {totalErrors} 項需修</span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          拖曳排序
        </Badge>
      </div>

      <div
        className="flex-1 overflow-auto p-2"
        onDragOver={(e) => {
          // 確保容器本身也是 drop target（覆蓋 Reorder.Group 可能吞掉事件的狀況）
          e.preventDefault();
        }}
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
              // 🏷️ 主標題：customName（若有）；副標題：模組類別
              // 這個排版平衡了「自訂識別」和「類別辨識」
              const pageWithName = page as Page & { customName?: string | null };
              const hasCustomName = !!pageWithName.customName?.trim();
              const primaryLabel = hasCustomName
                ? pageWithName.customName!
                : typeInfo.label;

              return (
                // 外層包裹 div 承接拖放 events（Reorder.Item 會吃掉 pointer events）
                <div
                  key={page.id}
                  // 原生 HTML5 drag events 綁在外層 div，不受 framer-motion Reorder.Item 的 pointer events 影響
                  onDragOver={(e) => onDragOver(e, index)}
                  onDrop={(e) => onDrop(e, index)}
                >
                  {/* 🎯 「放置於此」虛線框 — 必須自己處理 drop，
                      否則拖到虛線上方放開時 drop target 是這個 div，
                      沒有 onDrop 就什麼都不會發生 */}
                  {dragOverIndex === index && isDraggingFromToolbox && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 40 }}
                      className="border-2 border-dashed border-primary/50 rounded-lg bg-primary/10 flex items-center justify-center text-xs text-primary mb-1"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDrop(e, index);
                      }}
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
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    }}
                    data-testid={`page-item-${index}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${typeInfo.color} shrink-0`}
                    >
                      <typeInfo.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p
                          className="text-sm font-medium truncate"
                          title={hasCustomName ? pageWithName.customName! : undefined}
                        >
                          {primaryLabel}
                        </p>
                        {(issuesByPageId.get(page.id)?.errors ?? 0) > 0 && (
                          <AlertTriangle
                            className="w-3 h-3 text-destructive shrink-0"
                            aria-label={`${issuesByPageId.get(page.id)?.errors} 個設定錯誤`}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {hasCustomName ? (
                          <>
                            <span className="font-mono mr-1">#{index + 1}</span>
                            <span>·</span>
                            <span className="ml-1">{typeInfo.label}</span>
                          </>
                        ) : (
                          <span className="font-mono">#{index + 1}</span>
                        )}
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
            // 空清單時也要能接 drop
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropZoneDrop}
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
            // 「放置於最後」也要自己處理 drop
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropZoneDrop(e);
            }}
          >
            放置於最後
          </motion.div>
        )}
      </div>
    </aside>
  );
}
