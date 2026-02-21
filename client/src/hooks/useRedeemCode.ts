// 兌換碼兌換 Hook
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RedeemResult {
  message: string;
  scope: string;
  gameId: string;
  chapterId?: string;
}

export function useRedeemCode() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (code: string): Promise<RedeemResult> => {
      const res = await apiRequest("POST", "/api/redeem", { code });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "兌換成功" });
      // 刷新存取權快取
      queryClient.invalidateQueries({ queryKey: [`/api/games/${data.gameId}/access`] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "兌換失敗";
      toast({ title: msg, variant: "destructive" });
    },
  });
}
