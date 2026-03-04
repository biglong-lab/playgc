// 取得對戰系統使用的 fieldId
// 優先使用 user.defaultFieldId，否則從已載入的 venues 推導
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { BattleVenue } from "@shared/schema";

export function useBattleFieldId(): {
  fieldId: string | null;
  isLoading: boolean;
} {
  const { user } = useAuth();

  // 若用戶已設定 defaultFieldId，直接使用
  const userFieldId = user?.defaultFieldId ?? null;

  // 若沒有 defaultFieldId，從可用場地推導
  const { data: venues, isLoading } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues"],
    queryFn: async () => {
      const res = await fetch("/api/battle/venues");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !userFieldId,
  });

  if (userFieldId) {
    return { fieldId: userFieldId, isLoading: false };
  }

  // 從第一個可用場地取得 fieldId
  const venueFieldId = venues?.[0]?.fieldId ?? null;
  return { fieldId: venueFieldId, isLoading };
}
