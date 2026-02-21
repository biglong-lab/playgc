// 兌換碼管理 Hook
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RedeemCode, Purchase } from "@shared/schema";

interface CreateCodeData {
  scope: "game" | "chapter";
  chapterId?: string;
  maxUses: number;
  expiresAt?: string;
  label?: string;
}

interface BatchCreateData extends CreateCodeData {
  count: number;
}

interface GrantAccessData {
  userId: string;
  chapterId?: string;
  amount?: number;
  note?: string;
}

export function useRedeemCodes(gameId: string, isAdminStaff: boolean) {
  const { toast } = useToast();
  const apiBase = isAdminStaff ? "/api/admin" : "/api/admin";

  // 兌換碼列表
  const codesQuery = useQuery<RedeemCode[]>({
    queryKey: [`${apiBase}/games/${gameId}/redeem-codes`],
    enabled: !!gameId,
  });

  // 購買記錄列表
  const purchasesQuery = useQuery<Purchase[]>({
    queryKey: [`${apiBase}/games/${gameId}/purchases`],
    enabled: !!gameId,
  });

  // 建立單一兌換碼
  const createCode = useMutation({
    mutationFn: async (data: CreateCodeData) => {
      const res = await apiRequest("POST", `${apiBase}/games/${gameId}/redeem-codes`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "兌換碼已建立" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/redeem-codes`] });
    },
    onError: () => {
      toast({ title: "建立兌換碼失敗", variant: "destructive" });
    },
  });

  // 批次建立兌換碼
  const batchCreateCodes = useMutation({
    mutationFn: async (data: BatchCreateData) => {
      const res = await apiRequest("POST", `${apiBase}/games/${gameId}/redeem-codes/batch`, data);
      return res.json();
    },
    onSuccess: (data: { count: number }) => {
      toast({ title: `已建立 ${data.count} 個兌換碼` });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/redeem-codes`] });
    },
    onError: () => {
      toast({ title: "批次建立失敗", variant: "destructive" });
    },
  });

  // 更新兌換碼
  const updateCode = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `${apiBase}/redeem-codes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "兌換碼已更新" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/redeem-codes`] });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  // 刪除兌換碼
  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/redeem-codes/${id}`);
    },
    onSuccess: () => {
      toast({ title: "兌換碼已刪除" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/redeem-codes`] });
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  // 現金收款授權
  const grantAccess = useMutation({
    mutationFn: async (data: GrantAccessData) => {
      const res = await apiRequest("POST", `${apiBase}/games/${gameId}/grant-access`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已授權存取" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/purchases`] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "授權失敗";
      toast({ title: msg, variant: "destructive" });
    },
  });

  // 撤銷購買
  const revokePurchase = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/purchases/${id}`);
    },
    onSuccess: () => {
      toast({ title: "已撤銷購買" });
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/games/${gameId}/purchases`] });
    },
    onError: () => {
      toast({ title: "撤銷失敗", variant: "destructive" });
    },
  });

  return {
    codes: codesQuery.data ?? [],
    purchases: purchasesQuery.data ?? [],
    isLoading: codesQuery.isLoading || purchasesQuery.isLoading,
    createCode,
    batchCreateCodes,
    updateCode,
    deleteCode,
    grantAccess,
    revokePurchase,
  };
}
