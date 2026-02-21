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
