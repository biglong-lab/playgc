// 🏆 通用成就選擇器 — 跟 ItemSelect / LocationSelect 相同 pattern
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trophy } from "lucide-react";

interface Achievement {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  rarity?: string | null;
  achievementType?: string | null;
}

interface AchievementSelectProps {
  gameId?: string;
  value?: string | number;
  onChange: (achievementId: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export function AchievementSelect({
  gameId,
  value,
  onChange,
  allowEmpty = false,
  placeholder = "選擇成就...",
  className,
  testId,
}: AchievementSelectProps) {
  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/games", gameId, "achievements"],
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const currentValue = value != null && value !== "" ? String(value) : "";
  const existingAch = currentValue && achievements
    ? achievements.find((a) => String(a.id) === currentValue)
    : undefined;
  const hasValueButNotFound = !!currentValue && achievements && !existingAch;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentValue || "__empty__"}
        onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
      >
        <SelectTrigger className={className} data-testid={testId}>
          <SelectValue placeholder={isLoading ? "載入成就清單..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && (
            <SelectItem value="__empty__">
              <span className="text-muted-foreground">（無）</span>
            </SelectItem>
          )}
          {achievements?.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              尚無成就，請先到「成就管理」新增
            </div>
          )}
          {achievements?.map((ach) => (
            <SelectItem key={ach.id} value={String(ach.id)}>
              <span className="flex items-center gap-2">
                <Trophy className="w-3 h-3" />
                {ach.name}
                {ach.slug && (
                  <code className="text-xs text-muted-foreground">({ach.slug})</code>
                )}
                {ach.rarity && ach.rarity !== "common" && (
                  <Badge variant="outline" className="text-xs">
                    {ach.rarity}
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
