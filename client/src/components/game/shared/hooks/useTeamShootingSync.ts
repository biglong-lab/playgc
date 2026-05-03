// 🎯 useTeamShootingSync — 隊伍射擊同步 hook
//
// 用途：訂閱 WebSocket shooting_hit 事件，累積全隊命中紀錄，給 ShootingTeam 元件使用
//
// 實作：
//   - 連 ws://host/ws，發 join session 訊息
//   - onmessage 過濾 shooting_hit → 解析 record → 推進 teamHits
//   - record 中嘗試取 userId / displayName（server 端 TODO 補）
//   - 自動重連（最多 5 次，指數退避）
//
// 後端 TODO（part 3）：
//   - mqttService 接 hit 時要附 userId（依玩家綁定的 deviceId 反查）
//   - websocket.ts broadcastToSession 訊息加 userId / displayName 欄位
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.3 + §7.1

import { useCallback, useEffect, useRef, useState } from "react";
import type { TeamShootingHit } from "../../multi/ShootingTeam";

// ============================================================================
// 型別
// ============================================================================

/** Server 廣播的 hit record（隨後端 schema 演進，欄位採彈性） */
interface ServerHitRecord {
  // 基本欄位
  userId?: string;
  displayName?: string;
  hitZone?: string;
  targetZone?: string;
  // 位置（多種格式）
  hitPosition?: string | { x: number; y: number };
  // 分數（多種命名）
  score?: number;
  hitScore?: number;
  points?: number;
  // 時序
  timestamp?: string;
  hitAt?: string;
}

interface WsShootingMessage {
  type: string;
  record?: ServerHitRecord;
}

export interface UseTeamShootingSyncOptions {
  /** 場次 id（連 WebSocket 用） */
  sessionId: string;
  /** 我自己的 userId（用於 fallback displayName） */
  myUserId: string;
  /** 我自己的 displayName（fallback 給沒帶 userId 的紀錄） */
  myDisplayName: string;
  /** 是否啟用 */
  enabled?: boolean;
}

export interface UseTeamShootingSyncResult {
  /** 全隊命中紀錄（按時序） */
  teamHits: TeamShootingHit[];
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

/** 解析 record 為 TeamShootingHit（彈性欄位處理） */
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

// ============================================================================
// Hook
// ============================================================================

const MAX_RECONNECT_ATTEMPTS = 5;

export function useTeamShootingSync({
  sessionId,
  myUserId,
  myDisplayName,
  enabled = true,
}: UseTeamShootingSyncOptions): UseTeamShootingSyncResult {
  const [teamHits, setTeamHits] = useState<TeamShootingHit[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHits = useCallback(() => {
    setTeamHits([]);
  }, []);

  const injectHit = useCallback((hit: TeamShootingHit) => {
    setTeamHits((prev) => [...prev, hit]);
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          // 加入 session（用 server case "join"、之前送 "session_join" 是協定錯誤、server 沒對應 case → 收不到 shooting_hit 廣播）
          ws.send(
            JSON.stringify({
              type: "join",
              sessionId,
              userId: myUserId,
              userName: myDisplayName,
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WsShootingMessage;
            if (data.type === "shooting_hit" && data.record) {
              const hit = parseHitRecord(data.record, myUserId, myDisplayName);
              setTeamHits((prev) => [...prev, hit]);
            }
          } catch (err) {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          setError("WebSocket 連線錯誤");
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
          // 自動重連（指數退避）
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              1000 * 2 ** reconnectAttemptsRef.current,
              30_000,
            );
            reconnectAttemptsRef.current += 1;
            reconnectTimerRef.current = setTimeout(connect, delay);
          } else {
            setError("WebSocket 重連失敗，請重新整理頁面");
          }
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "WebSocket 建立失敗";
        setError(msg);
      }
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, sessionId, myUserId, myDisplayName]);

  return { teamHits, isConnected, error, clearHits, injectHit };
}
