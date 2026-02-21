// 我的購買記錄 Hook
import { useQuery } from "@tanstack/react-query";
import type { Purchase } from "@shared/schema";

export function usePurchases() {
  return useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });
}
