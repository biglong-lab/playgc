// 統一參戰 Dialog hook — Phase 16.4
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §21.1
//
// 用法：
//   const { open, openDialog, dialog } = useSquadParticipation({
//     onSelected: (squadId) => { /* 開始遊戲 */ }
//   });
//
//   <Button onClick={openDialog}>開始遊戲</Button>
//   {dialog}
//
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  SquadParticipationDialog,
  type UserSquad,
} from "@/components/squad/SquadParticipationDialog";

const LAST_USED_SQUAD_KEY = "chito:lastSquadId";

interface MeSquad {
  id: string;
  name: string;
  tag: string;
  myRole: string;
}

interface MeSquadsResponse {
  memberships: MeSquad[];
}

export interface UseSquadParticipationOptions {
  /** 使用者選定 squad 後觸發 */
  onSelected?: (squadId: string) => void;
  /** Dialog 標題 */
  title?: string;
}

export function useSquadParticipation(opts: UseSquadParticipationOptions = {}) {
  const { user, isSignedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // 取我的所有 Squad
  const { data: meSquads } = useQuery<MeSquadsResponse>({
    queryKey: ["/api/me/squads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/squads");
      return res.json();
    },
    enabled: isSignedIn,
  });

  // 上次用過的 squad ID
  const lastUsedId =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(LAST_USED_SQUAD_KEY)
      : null;

  // 轉換成 UserSquad 格式
  const userSquads: UserSquad[] = (meSquads?.memberships ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    tag: s.tag,
    isLastUsed: s.id === lastUsedId,
  }));

  const openDialog = useCallback(() => {
    if (!isSignedIn) {
      toast({
        title: "請先登入",
        description: "登入後才能參戰",
        variant: "destructive",
      });
      return;
    }
    setOpen(true);
  }, [isSignedIn, toast]);

  // 建立新 squad
  const createMut = useMutation({
    mutationFn: async (name: string) => {
      // 簡化：tag 取名稱前 3 字元
      const tag = name.slice(0, 5).toUpperCase();
      const res = await apiRequest("POST", "/api/squads", {
        name,
        tag,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "建立失敗");
      }
      return res.json();
    },
    onSuccess: (data: { id: string }) => {
      toast({ title: "✅ 隊伍已建立" });
      qc.invalidateQueries({ queryKey: ["/api/me/squads"] });
      try {
        localStorage.setItem(LAST_USED_SQUAD_KEY, data.id);
      } catch {
        /* ignore */
      }
      setOpen(false);
      opts.onSelected?.(data.id);
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  // 用邀請碼加入
  const joinMut = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest(
        "POST",
        `/api/invites/${token}/accept`,
        {},
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "加入失敗");
      }
      return res.json();
    },
    onSuccess: (data: { squadId: string }) => {
      toast({ title: "✅ 已加入隊伍" });
      qc.invalidateQueries({ queryKey: ["/api/me/squads"] });
      try {
        localStorage.setItem(LAST_USED_SQUAD_KEY, data.squadId);
      } catch {
        /* ignore */
      }
      setOpen(false);
      opts.onSelected?.(data.squadId);
    },
    onError: (err: Error) => {
      toast({ title: "加入失敗", description: err.message, variant: "destructive" });
    },
  });

  const handleUseSquad = useCallback(
    (squadId: string) => {
      try {
        localStorage.setItem(LAST_USED_SQUAD_KEY, squadId);
      } catch {
        /* ignore */
      }
      setOpen(false);
      opts.onSelected?.(squadId);
    },
    [opts],
  );

  const dialog = (
    <SquadParticipationDialog
      open={open}
      onOpenChange={setOpen}
      squads={userSquads}
      onUseSquad={handleUseSquad}
      onCreateSquad={(name) => createMut.mutate(name)}
      onJoinByCode={(token) => joinMut.mutate(token)}
      isLoading={createMut.isPending || joinMut.isPending}
      title={opts.title}
    />
  );

  return {
    open,
    setOpen,
    openDialog,
    dialog,
    userSquads,
  };
}
