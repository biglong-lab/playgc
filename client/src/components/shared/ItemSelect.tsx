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
    <div className="flex items-center gap-2">
      <Select value={value || "__empty__"} onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}>
        <SelectTrigger className={className} data-testid={testId}>
          <SelectValue placeholder={isLoading ? "載入道具清單..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
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
            <SelectItem key={item.id} value={item.id}>
              <span className="flex items-center gap-2">
                <Package className="w-3 h-3" />
                {item.name}
                {item.slug && (
                  <code className="text-xs text-muted-foreground">({item.slug})</code>
                )}
                {item.itemType && (
                  <Badge variant="outline" className="text-xs">
                    {item.itemType}
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
          {/* 舊資料相容：原 itemId 不在清單（例如 integer "16"）→ 顯示為警告選項 */}
          {hasValueButNotFound && (
            <SelectItem value={value}>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                舊資料：{value}（建議重選）
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
