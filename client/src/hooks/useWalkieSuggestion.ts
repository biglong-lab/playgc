// 進入多人元件時自動提示玩家「建議開啟對講機」
//
// 使用情境：
//   - VoteTeamPage / ShootingTeamPage / GpsTeamMissionPage 等多人元件 mount 時
//   - 同 session + 同 teamId 只提示一次（避免每翻一頁都跳）
//   - 玩家可點右下角 WalkieFloatingButton 開啟
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §7.2 WalkieSuggestionToast
//
// 為什麼用 hook 不用 component：
//   多人元件容器已經有自己的 fallback UI（loading / no team），
//   把 toast 行為內聚成 hook，呼叫一行 useWalkieSuggestion({ teamId })，
//   不在 JSX 樹多塞一個元件。

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const SHOWN_KEY_PREFIX = "chito:walkie-suggested";

interface UseWalkieSuggestionOptions {
  /** 當前隊伍 ID（沒組隊就不提示） */
  teamId?: string | null;
  /** 是否啟用提示（admin 後台開關 / 全域設定） */
  enabled?: boolean;
  /** 延遲多久才跳 toast（毫秒），讓元件先 render（預設 1500） */
  delayMs?: number;
}

/**
 * 多人元件入場時自動提示「建議開啟對講機」（同 session 同 team 只一次）
 *
 * @example
 *   // 在 VoteTeamPage / ShootingTeamPage / GpsTeamMissionPage 中
 *   useWalkieSuggestion({ teamId: myTeam?.id, enabled: true });
 */
export function useWalkieSuggestion({
  teamId,
  enabled = true,
  delayMs = 1500,
}: UseWalkieSuggestionOptions): void {
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled || !teamId) return;

    // 同 session 同 team 只提示一次（sessionStorage 在 tab 關掉就清）
    const key = `${SHOWN_KEY_PREFIX}:${teamId}`;
    try {
      if (typeof sessionStorage === "undefined") return;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage 不可用 → 直接跳，不阻塞
    }

    const timer = setTimeout(() => {
      toast({
        title: "💬 建議開啟對講機",
        description: "跟隊友溝通可以提升體驗，點右下角對講機按鈕開啟",
        duration: 5000,
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [teamId, enabled, delayMs, toast]);
}
