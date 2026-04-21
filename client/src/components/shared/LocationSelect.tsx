// 📍 通用地點選擇器 — 跟 ItemSelect 相同 pattern
//
// 用途：GPS Mission / visit_location 成就條件 / 頁面 locationId 引用等
// 解決：過往用 Input 自由輸入整數 ID（locationId: "16"）容易失效
// 方案：統一用 dropdown，同時顯示 slug（給跨遊戲模板對應）
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin } from "lucide-react";

interface Location {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  locationType?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

interface LocationSelectProps {
  gameId?: string;
  /** 目前選中的 location id（number 或 string） */
  value?: string | number;
  onChange: (locationId: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export function LocationSelect({
  gameId,
  value,
  onChange,
  allowEmpty = false,
  placeholder = "選擇地點...",
  className,
  testId,
}: LocationSelectProps) {
  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ["/api/games", gameId, "locations"],
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const currentValue = value != null && value !== "" ? String(value) : "";
  const existingLocation = currentValue && locations
    ? locations.find((l) => String(l.id) === currentValue)
    : undefined;
  const hasValueButNotFound = !!currentValue && locations && !existingLocation;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentValue || "__empty__"}
        onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
      >
        <SelectTrigger className={className} data-testid={testId}>
          <SelectValue placeholder={isLoading ? "載入地點清單..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && (
            <SelectItem value="__empty__">
              <span className="text-muted-foreground">（無）</span>
            </SelectItem>
          )}
          {locations?.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              尚無地點，請先到「地點管理」新增
            </div>
          )}
          {locations?.map((loc) => (
            <SelectItem key={loc.id} value={String(loc.id)}>
              <span className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                {loc.name}
                {loc.slug && (
                  <code className="text-xs text-muted-foreground">({loc.slug})</code>
                )}
                {loc.locationType && loc.locationType !== "custom" && (
                  <Badge variant="outline" className="text-xs">
                    {loc.locationType}
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
          {hasValueButNotFound && (
            <SelectItem value={currentValue}>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                舊資料：{currentValue}（建議重選）
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
