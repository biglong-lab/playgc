// 🚩 useTeamTerritorySync — TerritoryCapture 元件的 session 同步 hook（L3 持久化版 2026-05-05）
//
// 職責：
//   - 維護 captures 陣列（每點 teamId + capturedAt）
//   - 玩家佔領 → 本地更新 + WS 廣播 + DB 快照持久化
//   - 接收他隊廣播 → 同步狀態 + 更新本隊 DB 快照
//   - 挂載時從 DB 還原上次快照（page refresh survival）
//   - 10s polling fallback（WS 中斷保底）
//
// 設計說明：
//   - team_game_states 是 per-team（每隊各存一份 captures 快照）
//   - WS territory_capture_sync 仍是 session 範圍（多隊即時同步）
//   - 重整後：還原本隊快照，WS 補回其他隊的最新動態
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.8

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { apiRequest } from "@/lib/queryClient";
import type { TerritoryCapture } from "../../multi/TerritoryCapture";

interface UseTeamTerritorySyncOptions {
  teamId: string | undefined;
  sessionId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  pageId?: string;
  enabled?: boolean;
}

export interface TeamTerritoryState {
  captures: TerritoryCapture[];
  isLoaded: boolean;
  /** 玩家佔領點 — 更新本地 + 廣播 + 持久化 */
  onCapture: (pointId: string) => void;
}

interface TerritoryMessage {
  type: string;
  action?: string;
  payload?: {
    pointId?: string;
    teamId?: string;
    capturedAt?: number;
  };
}

export function useTeamTerritorySync({
  teamId,
  sessionId,
  userId,
  userName,
  pageId,
  enabled = true,
}: UseTeamTerritorySyncOptions): TeamTerritoryState {
  const [captures, setCaptures] = useState<TerritoryCapture[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const capturesRef = useRef<TerritoryCapture[]>([]);
  const versionRef = useRef(0);
  const fetchedRef = useRef(false);

  // 保持 ref 同步（給 onCapture 同步讀最新狀態用）
  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  // 持久化快照到 DB（fire-and-forget，不 block UI）
  const persistSnapshot = useCallback(
    (nextCaptures: TerritoryCapture[]) => {
      if (!teamId || !sessionId || !pageId) return;
      void apiRequest("POST", "/api/team-state", {
        teamId,
        sessionId,
        pageId,
        type: "territory_capture",
        state: { captures: nextCaptures },
        version: ++versionRef.current,
      });
    },
    [teamId, sessionId, pageId],
  );

  // 從 server 拉快照
  const fetchCaptures = useCallback(async () => {
    if (!teamId || !sessionId || !pageId) return;
    try {
      const resp = await apiRequest(
        "GET",
        `/api/team-state?teamId=${encodeURIComponent(teamId)}&sessionId=${encodeURIComponent(sessionId)}&pageId=${encodeURIComponent(pageId)}&type=territory_capture`,
      );
      // server 回傳格式：{ state: { state_json: { captures: [...] }, version: N } | null }
      const data = await resp.json() as { state?: { state_json?: { captures?: TerritoryCapture[] }; version?: number } | null };
      const saved = data?.state?.state_json?.captures;
      const savedVersion = data?.state?.version ?? 0;
      if (Array.isArray(saved) && savedVersion >= versionRef.current) {
        versionRef.current = savedVersion;
        setCaptures(saved);
      }
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, [teamId, sessionId, pageId]);

  // mount 時拉一次（fetchedRef 防止重複）
  useEffect(() => {
    if (!enabled || fetchedRef.current || !teamId || !sessionId || !pageId) return;
    fetchedRef.current = true;
    void fetchCaptures();
  }, [enabled, teamId, sessionId, pageId, fetchCaptures]);

  // 10s polling fallback
  useEffect(() => {
    if (!enabled || !teamId || !sessionId || !pageId) return;
    const id = setInterval(() => void fetchCaptures(), 10_000);
    return () => clearInterval(id);
  }, [enabled, teamId, sessionId, pageId, fetchCaptures]);

  const handleMessage = useCallback(
    (msg: TerritoryMessage) => {
      if (msg.type !== "territory_capture_sync") return;
      if (!msg.payload) return;
      const { pointId, teamId: capturedByTeam, capturedAt } = msg.payload;
      if (!pointId || typeof capturedAt !== "number") return;

      // 用 ref 取最新 captures，避免 stale closure
      const prev = capturesRef.current;
      const filtered = prev.filter((c) => c.pointId !== pointId);
      const next = [...filtered, { pointId, teamId: capturedByTeam ?? null, capturedAt }];
      setCaptures(next);
      persistSnapshot(next); // 記錄其他隊的佔領到本隊快照
    },
    [persistSnapshot],
  );

  const { sendTerritorySync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    alsoJoinSessionId: enabled ? sessionId : undefined,
    onMessage: handleMessage,
  });

  // 玩家按佔領
  const onCapture = useCallback(
    (pointId: string) => {
      if (!teamId) return;
      const now = Date.now();
      const prev = capturesRef.current;
      const filtered = prev.filter((c) => c.pointId !== pointId);
      const next = [...filtered, { pointId, teamId, capturedAt: now }];
      setCaptures(next);
      persistSnapshot(next);
      sendTerritorySync("capture", { pointId, teamId, capturedAt: now });
    },
    [teamId, sendTerritorySync, persistSnapshot],
  );

  // session 改變重置（換 session 不帶入上一場狀態）
  useEffect(() => {
    if (!sessionId) {
      setCaptures([]);
      fetchedRef.current = false;
      setIsLoaded(false);
    }
  }, [sessionId]);

  return { captures, isLoaded, onCapture };
}
