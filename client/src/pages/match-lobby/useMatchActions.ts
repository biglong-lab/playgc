// 🏁 賽事大廳動作（建立 / 加入 / 邀請碼加入 / 開賽 / 結束 / 離開），2026-09-23 P1
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { guestNameForServer } from "@/lib/guest-identity";

interface UseMatchActionsParams {
  gameId: string | undefined;
  matchId: string | null;
  isGuest: boolean;
  /** 建立 / 加入成功 → 進到這場（寫進網址） */
  onEnterMatch: (matchId: string) => void;
  /** 離開 / 取消 → 回到列表 */
  onLeftMatch: () => void;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useMatchActions({ gameId, matchId, isGuest, onEnterMatch, onLeftMatch }: UseMatchActionsParams) {
  const { toast } = useToast();
  const fail = (title: string) => (err: unknown) =>
    toast({ title, description: errorText(err, "請稍後再試"), variant: "destructive" });
  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "matches"] });
    if (matchId) queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId] });
  };
  const playerName = () => guestNameForServer(isGuest);

  const create = useMutation({
    mutationFn: async (isPrivate: boolean) =>
      (await apiRequest("POST", `/api/games/${gameId}/matches`, { playerName: playerName(), isPrivate })).json(),
    onSuccess: (m: { id: string }) => { refreshLists(); onEnterMatch(m.id); },
    onError: fail("建立失敗"),
  });

  const join = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("POST", `/api/matches/${id}/join`, { playerName: playerName() })).json(),
    onSuccess: (_d: unknown, id: string) => { refreshLists(); onEnterMatch(id); },
    onError: fail("加入失敗"),
  });

  const joinByCode = useMutation({
    mutationFn: async (code: string) =>
      (await apiRequest("POST", `/api/games/${gameId}/matches/join-by-code`, { code, playerName: playerName() })).json(),
    onSuccess: (p: { matchId: string }) => { refreshLists(); onEnterMatch(p.matchId); },
    onError: fail("加入失敗"),
  });

  const start = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/matches/${matchId}/start`)).json(),
    onSuccess: refreshLists,
    onError: fail("還不能開始"),
  });

  const finish = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/matches/${matchId}/finish`)).json(),
    onSuccess: refreshLists,
    onError: fail("結束失敗"),
  });

  // 🔒 房主把陌生人請出等待中的賽事
  const kick = useMutation({
    mutationFn: async (userId: string) => (await apiRequest("POST", `/api/matches/${matchId}/kick`, { userId })).json(),
    onSuccess: refreshLists,
    onError: fail("移除失敗"),
  });

  const leave = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/matches/${matchId}/leave`)).json(),
    onSuccess: () => { refreshLists(); onLeftMatch(); },
    onError: fail("退出失敗"),
  });

  return { create, join, joinByCode, start, finish, kick, leave };
}
