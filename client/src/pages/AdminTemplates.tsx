// 遊戲模組庫頁面 - 瀏覽、篩選、預覽和套用遊戲模組
import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ModuleCard from "@/components/module-library/ModuleCard";
import ModulePreviewDialog from "@/components/module-library/ModulePreviewDialog";
import CreateFromModuleDialog from "@/components/module-library/CreateFromModuleDialog";
import {
  GAME_MODULES,
  MODULE_CATEGORY_LABELS,
  type GameModule,
  type ModuleCategory,
} from "@shared/schema";
import { Search, Library, LayoutGrid } from "lucide-react";

/** 分類篩選選項 */
const CATEGORY_FILTERS: Array<{ key: ModuleCategory | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "outdoor", label: "戶外探索" },
  { key: "indoor", label: "室內解謎" },
  { key: "education", label: "教育學習" },
  { key: "team", label: "團隊競技" },
  { key: "digital", label: "數位互動" },
];

export default function AdminTemplates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ModuleCategory | "all">("all");
  const [previewModule, setPreviewModule] = useState<GameModule | null>(null);
  const [createModule, setCreateModule] = useState<GameModule | null>(null);

  // 篩選模組
  const filteredModules = useMemo(() => {
    return GAME_MODULES.filter((mod) => {
      // 分類篩選
      if (categoryFilter !== "all" && mod.category !== categoryFilter) {
        return false;
      }
      // 搜尋篩選
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const searchable = [
          mod.name,
          mod.description,
          mod.scenario,
          ...mod.tags,
          ...mod.highlights,
          MODULE_CATEGORY_LABELS[mod.category],
        ].join(" ").toLowerCase();
        return searchable.includes(query);
      }
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const handlePreview = (mod: GameModule) => {
    setPreviewModule(mod);
  };

  const handleApply = (mod: GameModule) => {
    setPreviewModule(null); // 關閉預覽（如果從預覽進入套用）
    setCreateModule(mod);
  };

  return (
    <AdminLayout title="遊戲模組庫">
      <div className="space-y-6">
        {/* 頁面標題區 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Library className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">模組庫</h2>
              <p className="text-sm text-muted-foreground">
                選擇模組快速建立遊戲，所有內容皆可在編輯器中自由修改
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            {GAME_MODULES.length} 套模組
          </Badge>
        </div>

        {/* 搜尋和篩選 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 搜尋框 */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋模組名稱、標籤、場景..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 分類篩選按鈕 */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_FILTERS.map((filter) => (
              <Button
                key={filter.key}
                variant={categoryFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(filter.key)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 模組卡片網格 */}
        {filteredModules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onPreview={handlePreview}
                onApply={handleApply}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">找不到符合的模組</p>
            <p className="text-sm mt-1">嘗試調整篩選條件或搜尋其他關鍵字</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
              }}
            >
              清除篩選
            </Button>
          </div>
        )}
      </div>

      {/* 預覽彈窗 */}
      <ModulePreviewDialog
        module={previewModule}
        open={previewModule !== null}
        onOpenChange={(open) => !open && setPreviewModule(null)}
        onApply={handleApply}
      />

      {/* 建立遊戲彈窗 */}
      <CreateFromModuleDialog
        module={createModule}
        open={createModule !== null}
        onOpenChange={(open) => !open && setCreateModule(null)}
      />
    </AdminLayout>
  );
}
