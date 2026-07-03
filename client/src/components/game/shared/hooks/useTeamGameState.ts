// 🗂️ useTeamGameState — 通用多人遊戲狀態持久化 hook（2026-05-05）
//
// 使用方式：
//   const { state, updateState, handleWsMessage, isLoaded } = useTeamGameState<MyState>({
//     teamId, sessionId, pageId, type: "relay_mission",
//     defaultState: { currentSegmentIndex: 0, completedSegments: [] },
//   });
//
// 對應後端：server/routes/team-game-state.ts
//   GET  /api/team-state?teamId=&sessionId=&pageId=&type=
//   POST /api/team-state
//   WS   team_state_updated { componentType, state, version }

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface UseTeamGameStateOptions<T> {
  teamId: string | undefined;
  sessionId: string;
  pageId: string;
  type: string;
  defaultState: T;
  enabled?: boolean;
}

export interface UseTeamGameStateResult<T> {
  state: T;
  version: number;
  isLoaded: boolean;
  updateState: (newState: T) => Promise<void>;
  handleWsMessage: (msg: { type: string; componentType?: string; state?: unknown; version?: number }) => void;
  /** 🛡️ 2026-07-04 Phase A3：立即重拉 server 狀態（重連補漏用、version 守衛防倒退）*/
  refetchNow: () => void;
}

export function useTeamGameState<T extends Record<string, unknown>>({
  teamId,
  sessionId,
  pageId,
  type,
  defaultState,
  enabled = true,
}: UseTeamGameStateOptions<T>): UseTeamGameStateResult<T> {
  const [state, setState] = useState<T>(defaultState);
  const [version, setVersion] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const versionRef = useRef(0);
  const fetchedRef = useRef(false);

  // 拉 server 狀態
  const fetchState = useCallback(async () => {
    if (!teamId || !enabled) return;
    try {
      const res = await apiRequest(
        "GET",
        `/api/team-state?teamId=${encodeURIComponent(teamId)}&sessionId=${encodeURIComponent(sessionId)}&pageId=${encodeURIComponent(pageId)}&type=${encodeURIComponent(type)}`,
      );
      const data = (await res.json()) as { state: { state_json: T; version: number } | null };
      if (data.state) {
        const sv = data.state.version;
        if (sv > versionRef.current) {
          versionRef.current = sv;
          setVersion(sv);
          setState(data.state.state_json as T);
        }
      }
    } catch {
      // silent
    } finally {
      setIsLoaded(true);
    }
  }, [teamId, sessionId, pageId, type, enabled]);

  // 初次掛載拉狀態
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

  // reset when disabled
  useEffect(() => {
    if (!enabled) {
      fetchedRef.current = false;
      setState(defaultState);
      setVersion(0);
      setIsLoaded(false);
      versionRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 更新狀態（POST 到 server、WS 廣播由 server 處理）
  // 🆕 2026-05-07 A2：收 409 → 拉新狀態 + retry 1 次（newState 套到最新 base）
  const updateState = useCallback(
    async (newState: T) => {
      if (!teamId || !enabled) return;

      const attempt = async (retry: boolean): Promise<void> => {
        const nextVersion = versionRef.current + 1;
        try {
          const res = await apiRequest("POST", "/api/team-state", {
            teamId,
            sessionId,
            pageId,
            type,
            state: newState,
            version: nextVersion,
          });

          if (res.status === 409) {
            // 樂觀鎖衝突：拉最新 → retry 一次（自動 merge 後再送）
            const data = (await res.json()) as { state?: { state_json: T; version: number } | null };
            if (data.state) {
              versionRef.current = data.state.version;
              setVersion(data.state.version);
              setState(data.state.state_json as T);
            }
            if (retry) {
              console.warn("[useTeamGameState] 樂觀鎖衝突、retry 1 次", type);
              await new Promise((r) => setTimeout(r, 200));
              await attempt(false);
            } else {
              console.warn("[useTeamGameState] 樂觀鎖衝突、retry 失敗、放棄此次寫入", type);
            }
            return;
          }

          const data = (await res.json()) as { state: { state_json: T; version: number } | null };
          if (data.state) {
            versionRef.current = data.state.version;
            setVersion(data.state.version);
            setState(data.state.state_json as T);
          }
        } catch (err) {
          console.error("[useTeamGameState] updateState 失敗:", err);
        }
      };

      await attempt(true);
    },
    [teamId, sessionId, pageId, type, enabled],
  );

  // 處理 WS 訊息（父層收到 team_state_updated 時呼叫）
  const handleWsMessage = useCallback(
    (msg: { type: string; componentType?: string; state?: unknown; version?: number }) => {
      if (msg.type !== "team_state_updated") return;
      if (msg.componentType !== type) return;
      const sv = msg.version ?? 0;
      if (sv > versionRef.current) {
        versionRef.current = sv;
        setVersion(sv);
        setState(msg.state as T);
      }
    },
    [type],
  );

  return { state, version, isLoaded, updateState, handleWsMessage };
}
