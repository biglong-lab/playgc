// 🔐 useTeamLockCoopSync — LockCoop 元件的隊伍同步 hook（L3 持久化版 2026-05-05）
//
// 改動：加入 server-side 持久化（team-lock-coop.ts）
//   - 掛載時 GET /api/team-lock-coop/state → 回復上次狀態
//   - 每次狀態變更 POST /api/team-lock-coop/update → 寫入 DB → server 廣播 lock_coop_updated
//   - 10s polling fallback 防 WS 漏訊息
//   - 同時保留 WS sendLockCoopSync 讓 code 輸入有即時感（WS 快 200ms、DB 慢但持久）

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { normalizeAnswer } from "@/lib/gameVerification";
import { apiRequest } from "@/lib/queryClient";
import type { LockCoopConfig } from "@shared/schema";

interface UseTeamLockCoopSyncOptions {
  teamId: string | undefined;
  sessionId: string;
  pageId: string;
  userId: string | undefined;
  userName: string | undefined;
  config: LockCoopConfig;
  enabled?: boolean;
}

export interface TeamLockCoopState {
  sharedCode: string;
  attempts: number;
  isUnlocked: boolean;
  isFailed: boolean;
  isLoaded: boolean;
  onCodeChange: (code: string) => void;
  onAttempt: () => void;
}

function normalizeCode(s: string): string {
  return normalizeAnswer(s ?? "");
}

interface LockCoopWsMessage {
  type: string;
  action?: string;
  payload?: { code?: string; attempts?: number };
  state?: { shared_code?: string; attempts?: number; is_unlocked?: boolean; is_failed?: boolean };
}

interface ServerLockState {
  shared_code: string;
  attempts: number;
  is_unlocked: boolean;
  is_failed: boolean;
  // 🆕 2026-05-07 A1：樂觀鎖 version
  version?: number;
}

export function useTeamLockCoopSync({
  teamId,
  sessionId,
  pageId,
  userId,
  userName,
  config,
  enabled = true,
}: UseTeamLockCoopSyncOptions): TeamLockCoopState {
  const [sharedCode, setSharedCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const fetchedRef = useRef(false);

  // 套用 server 回傳的狀態
  const applyServerState = useCallback((s: ServerLockState) => {
    setSharedCode(s.shared_code ?? "");
    setAttempts(s.attempts ?? 0);
    setIsUnlocked(!!s.is_unlocked);
    setIsFailed(!!s.is_failed);
  }, []);

  // 拉 server 狀態
  const fetchState = useCallback(async () => {
    if (!teamId || !enabled) return;
    try {
      const res = await apiRequest(
        "GET",
        `/api/team-lock-coop/state?teamId=${encodeURIComponent(teamId)}&sessionId=${encodeURIComponent(sessionId)}&pageId=${encodeURIComponent(pageId)}`,
      );
      const data = (await res.json()) as { state: ServerLockState | null };
      if (data.state) applyServerState(data.state);
    } catch {
      // silent
    } finally {
      setIsLoaded(true);
    }
  }, [teamId, sessionId, pageId, enabled, applyServerState]);

  // 掛載時拉狀態
  useEffect(() => {
    if (!enabled || !teamId || fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchState();
  }, [enabled, teamId, fetchState]);

  // 10s polling fallback
  useEffect(() => {
    if (!enabled || !teamId) return;
    const id = setInterval(() => void fetchState(), 10_000);
    return () => clearInterval(id);
  }, [enabled, teamId, fetchState]);

  // persist action to server（server 廣播 lock_coop_updated）
  const persistAction = useCallback(
    async (action: "code" | "attempt" | "unlocked" | "failed", payload?: { code?: string; attempts?: number }) => {
      if (!teamId) return;
      try {
        await apiRequest("POST", "/api/team-lock-coop/update", {
          teamId, sessionId, pageId, action, payload,
        });
      } catch (err) {
        console.error("[LockCoopSync] persist 失敗:", err);
      }
    },
    [teamId, sessionId, pageId],
  );

  const handleMessage = useCallback((msg: LockCoopWsMessage) => {
    // 支援新的 server-driven 廣播
    if (msg.type === "lock_coop_updated" && msg.state) {
      applyServerState(msg.state as ServerLockState);
      return;
    }
    // 向後相容舊 WS-only 廣播（純即時 code 同步）
    if (msg.type !== "team_lock_coop_sync") return;
    switch (msg.action) {
      case "code":
        if (typeof msg.payload?.code === "string") setSharedCode(msg.payload.code);
        break;
      case "attempt":
        if (typeof msg.payload?.attempts === "number") setAttempts(msg.payload.attempts);
        break;
      case "unlocked":
        setIsUnlocked(true);
        break;
      case "failed":
        setIsFailed(true);
        break;
    }
  }, [applyServerState]);

  const { sendLockCoopSync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    onMessage: handleMessage,
  });

  const onCodeChange = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code);
      setSharedCode(normalized);
      // 即時感：WS 廣播不等 DB
      sendLockCoopSync("code", { code: normalized });
      // 持久化（非同步，不阻塞 UI）
      void persistAction("code", { code: normalized });
    },
    [sendLockCoopSync, persistAction],
  );

  const onAttempt = useCallback(() => {
    if (isUnlocked || isFailed) return;
    const correct = normalizeCode(config.combination);
    const guess = normalizeCode(sharedCode);
    const newAttempts = attempts + 1;
    const maxAttempts = config.maxAttempts ?? 5;

    setAttempts(newAttempts);
    void persistAction("attempt", { attempts: newAttempts });

    if (guess === correct) {
      setIsUnlocked(true);
      void persistAction("unlocked");
    } else if (newAttempts >= maxAttempts) {
      setIsFailed(true);
      void persistAction("failed");
    }
  }, [sharedCode, config.combination, config.maxAttempts, attempts, isUnlocked, isFailed, persistAction]);

  useEffect(() => {
    if (!teamId) {
      fetchedRef.current = false;
      setSharedCode("");
      setAttempts(0);
      setIsUnlocked(false);
      setIsFailed(false);
      setIsLoaded(false);
    }
  }, [teamId]);

  return { sharedCode, attempts, isUnlocked, isFailed, isLoaded, onCodeChange, onAttempt };
}
