import type { Request, Response } from "express";
import { WebSocket } from "ws";
import type { User } from "@shared/schema";

export interface WebSocketClient extends WebSocket {
  sessionId?: string;
  teamId?: string;
  userId?: string;
  userName?: string;
  isAlive?: boolean;
  authenticatedUserId?: string;  // 經 token 驗證的用戶 ID
  matchId?: string;              // 對戰房間 ID
  battleSlotId?: string;         // 水彈對戰時段 ID
  // 🆕 ADR-0004 (2026-05-02)：HostScreen 主控大螢幕模式
  hostSessionId?: string;        // host session id
  hostRole?: "host" | "player";  // host = 大螢幕端、player = 玩家端
  // 🆕 ADR-0015 (2026-05-03)：WS-level rate limit（防腳本灌訊息）
  rateWindowStart?: number;      // 當前秒級窗口起始 timestamp
  rateMsgCount?: number;         // 當前窗口內已收訊息數
  // 🆕 2026-05-05: heartbeat missed pong 計數（連續 2 次未回 pong 才 terminate）
  missedPings?: number;
}

/** WebSocket 廣播訊息型別 */
export interface WsBroadcastMessage {
  type: string;
  [key: string]: unknown;
}

export interface RouteContext {
  broadcastToSession: (sessionId: string, message: WsBroadcastMessage) => void;
  broadcastToTeam: (teamId: string, message: WsBroadcastMessage, excludeClient?: WebSocketClient) => void;
  broadcastToMatch: (matchId: string, message: WsBroadcastMessage) => void;
  broadcastToBattleSlot: (slotId: string, message: WsBroadcastMessage) => void;
  /** 🆕 Phase 2c：取消隊員的斷線寬限期計時器（leader-decide / 重連時用） */
  cancelDisconnectTimer?: (teamId: string, userId: string) => void;
  /** 🆕 ADR-0004：HostScreen 主控大螢幕廣播 */
  broadcastToHostSession?: (sessionId: string, message: WsBroadcastMessage, hostOnly?: boolean) => void;
  /** 🆕 2026-05-07 A4：把指定 user 從 team ws connections 踢掉（玩家被移出隊伍時用）*/
  kickUserFromTeam?: (teamId: string, userId: string, reason?: string) => void;
}

// 經 Firebase 認證後的 Request 型別
export interface AuthenticatedRequest extends Request {
  user?: {
    claims: {
      sub: string;
    };
    dbUser: User;
  };
}

// 統一 API 錯誤回應格式
export function apiError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}
