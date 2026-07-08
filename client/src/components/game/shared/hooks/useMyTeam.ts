// 👥 useMyTeam — 多人元件容器共用的「我的隊伍」查詢
//
// 背景（2026-07-09 全站優化盤點 C2）：
//   7 個多人 XxxPage 容器（VoteTeam/Shooting/Territory/Relay/LockCoop/
//   GpsTeamMission/ChoiceVerifyRace）各自複製同一段 my-team useQuery
//   （含 10s refetch、loading/error 分支）≈ 250-350 行重複碼，
//   之前的同步 bug（refetchInterval 有的頁有、有的沒有）就是複製漂移的結果。
//   抽成單一 hook：查詢行為只有一份、未來調整（間隔/快取）一處生效。
//
// 設計：
//   - queryKey 沿用 `/api/games/${gameId}/my-team`（與 GamePlay/TeamRequiredFallback
//     的 invalidate 對齊 — rejoin 成功後這裡會自動刷新）
//   - 10s refetch：被移出隊伍後 myTeam 轉 null → 容器切 TeamRequiredFallback
//     （含「重新連線原隊伍」回歸入口），不再卡舊快取死轉

import { useQuery } from "@tanstack/react-query";

/** my-team 回傳（各容器共用的最小欄位；完整欄位見 server teams.ts my-team） */
export interface MyTeamData {
  id: string;
  name?: string;
  leaderId?: string | null;
  status?: string;
  activeSessionId?: string | null;
  sessionInterrupted?: boolean;
  members: Array<{
    userId: string;
    role?: string;
    user?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      profileImageUrl?: string | null;
    };
  }>;
}

export interface UseMyTeamResult {
  myTeam: MyTeamData | null | undefined;
  teamId: string | undefined;
  /** 現任成員數（投票分母等用；myTeam 未載入時 0） */
  totalMembers: number;
  teamLoading: boolean;
  teamError: boolean;
}

/**
 * @param gameId 遊戲 id
 * @param enabled 額外啟用條件（通常傳 `!!user`）
 */
export function useMyTeam(
  gameId: string | undefined,
  enabled: boolean = true,
): UseMyTeamResult {
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamData | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && enabled,
    // 🛡️ 10s refetch：成員變動（加入/離開/被移出）各裝置 10 秒內跟上
    refetchInterval: 10_000,
  });

  return {
    myTeam,
    teamId: myTeam?.id,
    totalMembers: myTeam?.members?.length ?? 0,
    teamLoading,
    teamError,
  };
}
