// 🚦 編輯器「發布」（2026-09-23）：先存內容（頁面同步完）→ 再把狀態改成 published
//   伺服器用剛同步好的頁面跑前後端共用的發佈檢查；不合格逐條列出原因
//   原本是「先送 status=published、後同步頁面」→ 伺服器檢查到的是舊頁面，而且那條路根本沒檢查
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { describePublishError } from "@/components/game-wizard/publish-game";

export function usePublishFromEditor(apiGamesPath: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (gameId: string) =>
      (await apiRequest("PATCH", `${apiGamesPath}/${gameId}`, { status: "published" })).json(),
    onSuccess: () => {
      toast({ title: "已發布", description: "玩家現在可以玩這款遊戲了" });
      queryClient.invalidateQueries({ queryKey: [apiGamesPath] });
    },
    onError: (err: unknown) => {
      const info = describePublishError(err);
      toast({
        title: "還不能發布",
        description: [info.message, ...info.details].join("\n"),
        variant: "destructive",
      });
    },
  });
}
