// 🎯 useTeamShootingSync — 隊伍射擊同步 hook（L3 持久化版 2026-05-05）
//
// 用途：訂閱 WebSocket shooting_hit 事件，累積全隊命中紀錄，給 ShootingTeam 元件使用
//
// 實作：
//   - 連 ws://host/ws，發 join session 訊息（保留原有 WS 實作）
//   - onmessage 過濾 shooting_hit → 解析 record → 推進 teamHits
//   - 挂載時從 DB 拉歷史 hits（page refresh survival）
//   - 10s polling fallback 補齊錯過的 hits
//   - DB 去重：以 hit_at timestamp 為 key，避免 WS + DB 重複顯示
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.3 + §7.1

import { useCallback, useEffect, useRef, useState } from "react";
import type { TeamShootingHit } from "../../multi/ShootingTeam";
// 🌐 Phase 3 (2026-05-08)：永遠走全域 WS Provider
import { useWebSocket } from "@/contexts/WebSocketContext";

// ============================================================================
// 型別
// ============================================================================

/** Server 廣播的 hit record（隨後端 schema 演進，欄位採彈性） */
interface ServerHitRecord {
  userId?: string;
  displayName?: string;
  hitZone?: string;
  targetZone?: string;
  hitPosition?: string | { x: number; y: number };
  score?: number;
  hitScore?: number;
  points?: number;
  timestamp?: string;
  hitAt?: string;
}

interface WsShootingMessage {
  type: string;
  record?: ServerHitRecord;
}

/** DB 命中紀錄格式（snake_case，server 回傳） */
interface DbHitRow {
  user_id: string;
  display_name: string;
  hit_zone: string;
  score: number;
  hit_at: string;
}

export interface UseTeamShootingSyncOptions {
  /** 場次 id（連 WebSocket 用） */
  sessionId: string;
  /** 我自己的 userId（用於 fallback displayName） */
  myUserId: string;
  /** 我自己的 displayName（fallback 給沒帶 userId 的紀錄） */
  myDisplayName: string;
  /** 隊伍 id（DB 查詢用）*/
  teamId?: string;
  /** 頁面 id（DB 查詢用） */
  pageId?: string;
  /** 是否啟用 */
  enabled?: boolean;
}

export interface UseTeamShootingSyncResult {
  /** 全隊命中紀錄（按時序） */
  teamHits: TeamShootingHit[];
  /** DB 歷史命中已載入完成 */
  isLoaded: boolean;
  /** WebSocket 是否連線中 */
  isConnected: boolean;
  /** 錯誤訊息 */
  error: string | null;
  /** 手動清空命中（reset 用） */
  clearHits: () => void;
  /** 注入測試用 hit（給單元測試 / dev 模式） */
  injectHit: (hit: TeamShootingHit) => void;
}

// ============================================================================
// 純函式 helpers
// ============================================================================

/** 解析 WS record 為 TeamShootingHit（彈性欄位處理） */
export function parseHitRecord(
  record: ServerHitRecord,
  fallbackUserId: string,
  fallbackDisplayName: string,
): TeamShootingHit {
  const score = record.score ?? record.hitScore ?? record.points ?? 0;
  const hitZone = record.hitZone ?? record.targetZone ?? "outer";
  const userId = record.userId ?? fallbackUserId;
  const displayName = record.displayName ?? fallbackDisplayName;
  const timestamp = record.timestamp ?? record.hitAt ?? new Date().toISOString();
  return { userId, displayName, hitZone, score, timestamp };
}

/** 合併 DB hits 和 WS hits，以 timestamp 去重 */
function mergeHits(
  dbHits: TeamShootingHit[],
  wsHits: TeamShootingHit[],
): TeamShootingHit[] {
  const dbTimestamps = new Set(dbHits.map((h) => h.timestamp));
  const wsOnly = wsHits.filter((h) => !dbTimestamps.has(h.timestamp));
  return [...dbHits, ...wsOnly].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamShootingSync({
  sessionId,
  myUserId,
  myDisplayName,
  teamId,
  pageId,
  enabled = true,
}: UseTeamShootingSyncOptions): UseTeamShootingSyncResult {
  const [teamHits, setTeamHits] = useState<TeamShootingHit[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // WS-only hits（還沒存入 DB 的即時事件）
  const wsHitsRef = useRef<TeamShootingHit[]>([]);

  const fetchedRef = useRef(false);

  const clearHits = useCallback(() => {
    wsHitsRef.current = [];
    setTeamHits([]);
  }, []);

  const injectHit = useCallback((hit: TeamShootingHit) => {
    wsHitsRef.current = [...wsHitsRef.current, hit];
    setTeamHits((prev) => [...prev, hit]);
  }, []);

  // 從 DB 拉歷史 hits
  const fetchHitsFromDb = useCallback(async () => {
    if (!teamId || !pageId || !sessionId) return;
    try {
      const resp = await fetch(
        `/api/team-shooting/hits?teamId=${encodeURIComponent(teamId)}&sessionId=${encodeURIComponent(sessionId)}&pageId=${encodeURIComponent(pageId)}`,
        { credentials: "include" },
      );
      if (!resp.ok) return;
      // server 回傳格式：{ hits: [...] }
      const data = await resp.json() as { hits: DbHitRow[] };
      const rows = data.hits ?? [];
      const dbHits = rows.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        hitZone: r.hit_zone,
        score: r.score,
        timestamp: r.hit_at,
      }));
      setTeamHits(mergeHits(dbHits, wsHitsRef.current));
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, [teamId, pageId, sessionId]);

  // mount 時拉一次
  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchHitsFromDb();
  }, [enabled, fetchHitsFromDb]);

  // 10s polling fallback
  useEffect(() => {
    if (!enabled || !teamId || !pageId) return;
    const id = setInterval(() => void fetchHitsFromDb(), 10_000);
    return () => clearInterval(id);
  }, [enabled, teamId, pageId, fetchHitsFromDb]);

  // 🌐 透過全域 ws Provider 訂閱 shooting_hit
  const wsProvider = useWebSocket();

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const release = wsProvider.ensureConnected();
    const releaseJoin = wsProvider.registerOnConnect(
      `shooting:${sessionId}:${myUserId}`,
      (ws) => {
        ws.send(
          JSON.stringify({
            type: "join",
            sessionId,
            userId: myUserId,
            userName: myDisplayName,
          }),
        );
      },
    );
    const unsubscribe = wsProvider.subscribe((data) => {
      const msg = data as WsShootingMessage;
      if (msg.type === "shooting_hit" && msg.record) {
        const hit = parseHitRecord(msg.record, myUserId, myDisplayName);
        wsHitsRef.current = [...wsHitsRef.current, hit];
        setTeamHits((prev) => {
          const existingTs = new Set(prev.map((h) => h.timestamp));
          if (existingTs.has(hit.timestamp)) return prev;
          return [...prev, hit];
        });
      }
    });

    return () => {
      releaseJoin();
      unsubscribe();
      release();
    };
  }, [enabled, sessionId, myUserId, myDisplayName, wsProvider]);

  // 同步 isConnected from provider
  useEffect(() => {
    setIsConnected(wsProvider.isConnected);
  }, [wsProvider.isConnected]);

  return { teamHits, isLoaded, isConnected, error, clearHits, injectHit };
}
