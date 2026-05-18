// 🎒 通用道具選擇器 — 所有需要選 item 的 editor 都應該用這個
//
// 解決問題：編輯器的 itemId 之前用 Input 自由輸入，管理員自己填 "16" / "label" 等，
//   導致資料引用不存在的 item，玩家條件驗證永遠失敗。
// 解決方案：統一從 /api/admin/games/:gameId/items 拉清單，以 dropdown 選擇。
// 相容性：若 value 不在清單內（舊資料、未遷移的 integer id），
//   會顯示「⚠️ 找不到道具（原值：XXX）」讓管理員明確知道要重選。
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface Item {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemType?: string | null;
  iconUrl?: string | null;
}

interface ItemSelectProps {
  /** 遊戲 ID（從 items 清單拉資料用） */
  gameId?: string;
  /** 目前選中的 item id */
  value?: string;
  /** 變更時觸發 */
  onChange: (itemId: string) => void;
  /** 允許「無」選項（例如 ConditionalVerify 的 fragment 未綁道具） */
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  /** data-testid for Playwright / 測試 */
  testId?: string;
}

export function ItemSelect({
  gameId,
  value,
  onChange,
  allowEmpty = false,
  placeholder = "選擇道具...",
  className,
  testId,
}: ItemSelectProps) {
  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/admin/games", gameId, "items"],
    queryFn: () => fetchWithAdminAuth(`/api/admin/games/${gameId}/items`),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const existingItem = value && items ? items.find((i) => i.id === value) : undefined;
  const hasValueButNotFound = !!value && items && !existingItem;

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Select value={value || "__empty__"} onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}>
        <SelectTrigger
          className={`min-w-0 w-full max-w-full ${className ?? ""}`}
          data-testid={testId}
          title={existingItem ? `${existingItem.name}${existingItem.slug ? ` (${existingItem.slug})` : ""}` : undefined}
        >
          <SelectValue placeholder={isLoading ? "載入道具清單..." : placeholder} />
        </SelectTrigger>
        {/* 🐛 2026-05-18 #5：業主回報名稱/ID 截斷看不到
            選項改兩行顯示（名稱粗體 + slug/ID 灰色小字）+ 桌機 min-width 360px */}
        <SelectContent className="min-w-[260px] sm:min-w-[360px] max-w-[480px]">
          {allowEmpty && (
            <SelectItem value="__empty__">
              <span className="text-muted-foreground">（無）</span>
            </SelectItem>
          )}
          {items?.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              尚無道具，請先到「道具管理」新增
            </div>
          )}
          {items?.map((item) => (
            <SelectItem
              key={item.id}
              value={item.id}
              title={`${item.name}${item.slug ? ` (${item.slug})` : ""} · ${item.id}`}
            >
              <span className="flex items-start gap-2 py-0.5">
                <Package className="w-3 h-3 flex-shrink-0 mt-1" />
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-sm leading-tight break-all">{item.name}</span>
                  {(item.slug || item.itemType) && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground leading-tight mt-0.5">
                      {item.slug && <code className="font-mono">{item.slug}</code>}
                      {item.itemType && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.itemType}
                        </Badge>
                      )}
                    </span>
                  )}
                </span>
              </span>
            </SelectItem>
          ))}
          {hasValueButNotFound && (
            <SelectItem value={value}>
              <span className="flex items-center gap-1 text-amber-600 whitespace-nowrap overflow-hidden">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">舊資料：{value}（建議重選）</span>
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
