import { WebSocket } from "ws";

export interface WebSocketClient extends WebSocket {
  sessionId?: string;
  teamId?: string;
  userId?: string;
  userName?: string;
  isAlive?: boolean;
}

export interface RouteContext {
  broadcastToSession: (sessionId: string, message: any) => void;
  broadcastToTeam: (teamId: string, message: any, excludeClient?: WebSocketClient) => void;
}
