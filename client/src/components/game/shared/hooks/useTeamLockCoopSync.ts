// 🔐 useTeamLockCoopSync — LockCoop 元件的隊伍同步 hook
//
// 職責：
//   - 維護隊伍共享密碼輸入（任一玩家輸入即同步給全隊）
//   - 嘗試解鎖時驗證（client-side），結果廣播給隊友
//   - 累計嘗試次數（隊伍共用）
//   - 達到 maxAttempts 觸發 isFailed
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.5
//
// 為什麼驗證在 client 不在 server：
//   - LockCoop 是協作體驗為主，不是計分核心（玩家拿到的分數來自 onComplete reward）
//   - 純 client 廣播降低 server 複雜度，且本元件無計分作弊空間（密碼 admin 預先公開給玩家以線索形式）
//   - 若日後需要防作弊（防玩家修改 client 程式繞過），可改 server-side 驗證

import { useCallback, useEffect, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { normalizeAnswer } from "@/lib/gameVerification";
import type { LockCoopConfig } from "@shared/schema";

interface UseTeamLockCoopSyncOptions {
  teamId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  config: LockCoopConfig;
  /** 是否啟用 hook（false 時不連 WebSocket 也不更新狀態） */
  enabled?: boolean;
}

export interface TeamLockCoopState {
  sharedCode: string;
  attempts: number;
  isUnlocked: boolean;
  isFailed: boolean;
  /** 玩家修改密碼輸入 — 同步給隊友 */
  onCodeChange: (code: string) => void;
  /** 玩家按嘗試解鎖 — 驗證 + 廣播 */
  onAttempt: () => void;
}

/** 統一密碼正規化（normalizeAnswer 已處理 trim + 大小寫） */
function normalizeCode(s: string): string {
  return normalizeAnswer(s ?? "");
}

interface LockCoopMessage {
  type: string;
  action?: string;
  payload?: { code?: string; attempts?: number };
  userId?: string;
}

export function useTeamLockCoopSync({
  teamId,
  userId,
  userName,
  config,
  enabled = true,
}: UseTeamLockCoopSyncOptions): TeamLockCoopState {
  const [sharedCode, setSharedCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  const handleMessage = useCallback((msg: LockCoopMessage) => {
    if (msg.type !== "team_lock_coop_sync") return;
    if (!msg.action) return;

    switch (msg.action) {
      case "code":
        if (typeof msg.payload?.code === "string") {
          setSharedCode(msg.payload.code);
        }
        break;
      case "attempt":
        if (typeof msg.payload?.attempts === "number") {
          setAttempts(msg.payload.attempts);
        }
        break;
      case "unlocked":
        setIsUnlocked(true);
        break;
      case "failed":
        setIsFailed(true);
        break;
    }
  }, []);

  const { sendLockCoopSync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    onMessage: handleMessage,
  });

  // 玩家修改密碼輸入
  const onCodeChange = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code);
      setSharedCode(normalized);
      sendLockCoopSync("code", { code: normalized });
    },
    [sendLockCoopSync],
  );

  // 玩家按嘗試解鎖
  const onAttempt = useCallback(() => {
    if (isUnlocked || isFailed) return;

    const correct = normalizeCode(config.combination);
    const guess = normalizeCode(sharedCode);
    const newAttempts = attempts + 1;
    const maxAttempts = config.maxAttempts ?? 5;

    setAttempts(newAttempts);
    sendLockCoopSync("attempt", { attempts: newAttempts });

    if (guess === correct) {
      setIsUnlocked(true);
      sendLockCoopSync("unlocked", {});
    } else if (newAttempts >= maxAttempts) {
      setIsFailed(true);
      sendLockCoopSync("failed", {});
    }
  }, [
    sharedCode,
    config.combination,
    config.maxAttempts,
    attempts,
    isUnlocked,
    isFailed,
    sendLockCoopSync,
  ]);

  // 元件 unmount 或重連時保險：teamId 改變重置狀態
  useEffect(() => {
    if (!teamId) {
      setSharedCode("");
      setAttempts(0);
      setIsUnlocked(false);
      setIsFailed(false);
    }
  }, [teamId]);

  return {
    sharedCode,
    attempts,
    isUnlocked,
    isFailed,
    onCodeChange,
    onAttempt,
  };
}
