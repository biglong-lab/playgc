// 🎒 通用道具多選器 — 用於 button.items / reward.items 等需要選多個 item 的欄位
//
// 解決問題：原本 Input 逗號分隔自由輸入 → 管理員易寫錯 id（"16" 非 UUID）
// 設計：popover + checkbox 列表 + 已選 chip 顯示
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Package, Plus, X } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface Item {
  id: string;
  name: string;
  itemType?: string | null;
}

interface ItemMultiSelectProps {
  gameId?: string;
  /** 已選 itemIds（string[]）*/
  value: string[];
  onChange: (itemIds: string[]) => void;
  className?: string;
  testId?: string;
}

export function ItemMultiSelect({ gameId, value, onChange, className, testId }: ItemMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/admin/games", gameId, "items"],
    queryFn: () => fetchWithAdminAuth(`/api/admin/games/${gameId}/items`),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const valueSet = new Set(value);
  const toggle = (id: string) => {
    if (valueSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  // 找出 value 中不在 items 清單的（舊資料如 "16"）
  const dangling = items ? value.filter((v) => !items.some((i) => i.id === v)) : [];
  const matched = items ? value.filter((v) => items.some((i) => i.id === v)) : [];

  return (
    <div className={className} data-testid={testId}>
      <div className="flex flex-wrap gap-1 mb-1">
        {matched.map((id) => {
          const item = items?.find((i) => i.id === id);
          return (
            <Badge key={id} variant="secondary" className="gap-1">
              <Package className="w-3 h-3" />
              {item?.name || id}
              <button
                type="button"
                onClick={() => toggle(id)}
                className="hover:text-destructive ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
        {dangling.map((id) => (
          <Badge key={id} variant="outline" className="gap-1 border-amber-500 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            舊資料：{id}
            <button
              type="button"
              onClick={() => toggle(id)}
              className="hover:text-destructive ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1">
              <Plus className="w-3 h-3" />
              {value.length === 0 ? "選擇道具" : "新增"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="text-xs text-muted-foreground p-2">載入道具清單...</div>
            ) : items?.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">
                尚無道具，請先到「道具管理」新增
              </div>
            ) : (
              <div className="space-y-1">
                {items?.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={valueSet.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                    />
                    <Package className="w-3 h-3 text-muted-foreground" />
                    <span className="flex-1">{item.name}</span>
                    {item.itemType && (
                      <Badge variant="outline" className="text-xs">
                        {item.itemType}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
