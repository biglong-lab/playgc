import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { AddressInfo } from "net";

// vi.hoisted 確保 mock 變數在 vi.mock hoisting 後仍可存取
const { mockSetHitBroadcastHandler, mockCreateChatMessage } = vi.hoisted(() => ({
  mockSetHitBroadcastHandler: vi.fn(),
  mockCreateChatMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("../storage", () => ({
  storage: {
    createChatMessage: mockCreateChatMessage,
  },
}));

// Mock mqttService
vi.mock("../mqttService", () => ({
  mqttService: {
    setHitBroadcastHandler: mockSetHitBroadcastHandler,
  },
}));

// Mock firebaseAuth
vi.mock("../firebaseAuth", () => ({
  verifyFirebaseToken: vi.fn(async (token: string) => {
    if (token === "valid-firebase-token") {
      return { uid: "firebase-user-1" };
    }
    throw new Error("Invalid token");
  }),
}));

// Mock db（websocket.ts 新增了 db import 用於 match_countdown_complete）
vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

import { setupWebSocket } from "../routes/websocket";

// 等待 WebSocket 連線建立
function connectWs(port: number, params = ""): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws${params}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

// 等待收到指定類型的訊息
function waitForMessage(ws: WebSocket, expectedType?: string, timeout = 2000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`等待訊息超時 (${expectedType})`)), timeout);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (!expectedType || msg.type === expectedType) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

describe("websocket 路由", () => {
  let server: http.Server;
  let port: number;
  let ctx: { broadcastToSession: (sid: string, msg: unknown) => void; broadcastToTeam: (tid: string, msg: unknown) => void };
  const openSockets: WebSocket[] = [];

  beforeEach((testCtx) => {
    vi.clearAllMocks();
    return new Promise<void>((resolve) => {
      server = http.createServer();
      ctx = setupWebSocket(server);
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(() => {
    return new Promise<void>((resolve) => {
      // 關閉所有測試中打開的 WebSocket
      openSockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      });
      openSockets.length = 0;
      server.close(() => resolve());
    });
  });

  function trackWs(ws: WebSocket): WebSocket {
    openSockets.push(ws);
    return ws;
  }

  describe("連線與認證", () => {
    it("可以建立基本連線", async () => {
      const ws = trackWs(await connectWs(port));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("帶有 Firebase token 的連線可通過認證", async () => {
      const ws = trackWs(await connectWs(port, "?token=valid-firebase-token"));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("無效 token 仍可連線（向後兼容）", async () => {
      const ws = trackWs(await connectWs(port, "?token=bad-token"));
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe("session 加入與廣播", () => {
    it("加入 session 後接收廣播", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      // ws1 加入 session
      ws1.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u1", userName: "玩家一" }));
      // 等一下確保加入完成
      await new Promise((r) => setTimeout(r, 100));

      // ws2 加入同一個 session，ws1 應該收到通知
      const msgPromise = waitForMessage(ws1, "user_joined");
      ws2.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u2", userName: "玩家二" }));

      const msg = await msgPromise;
      expect(msg.userId).toBe("u2");
      expect(msg.userName).toBe("玩家二");
    });
  });

  describe("team 加入與廣播", () => {
    it("加入 team 後接收廣播", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_member_joined");
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u2", userName: "成員二" }));

      const msg = await msgPromise;
      expect(msg.userId).toBe("u2");
    });
  });

  describe("team_chat", () => {
    it("團隊聊天訊息廣播", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u2", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_chat");
      ws2.send(JSON.stringify({
        type: "team_chat",
        userId: "u2",
        userName: "成員二",
        message: "你好！",
      }));

      const msg = await msgPromise;
      expect(msg.message).toBe("你好！");
    });
  });

  describe("team_ready", () => {
    it("準備狀態廣播", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u2", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_ready_update");
      ws2.send(JSON.stringify({
        type: "team_ready",
        userId: "u2",
        userName: "成員二",
        isReady: true,
      }));

      const msg = await msgPromise;
      expect(msg.isReady).toBe(true);
    });
  });

  describe("chat（session 聊天）", () => {
    it("session 聊天會儲存訊息並廣播", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u1", userName: "玩家一" }));
      ws2.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u2", userName: "玩家二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "chat");
      ws2.send(JSON.stringify({
        type: "chat",
        userId: "u2",
        userName: "玩家二",
        message: "哈囉",
      }));

      const msg = await msgPromise;
      expect(msg.message).toBe("哈囉");
      // 確認有儲存聊天訊息
      expect(mockCreateChatMessage).toHaveBeenCalled();
    });
  });

  describe("broadcastToSession / broadcastToTeam 工具函式", () => {
    it("broadcastToSession 傳送訊息到指定 session", async () => {
      const ws = trackWs(await connectWs(port));

      ws.send(JSON.stringify({ type: "join", sessionId: "s-test", userId: "u1", userName: "測試" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws, "custom_event");
      ctx.broadcastToSession("s-test", { type: "custom_event", data: "hello" });

      const msg = await msgPromise;
      expect(msg.data).toBe("hello");
    });

    it("broadcastToTeam 傳送訊息到指定 team", async () => {
      const ws = trackWs(await connectWs(port));

      ws.send(JSON.stringify({ type: "team_join", teamId: "t-test", userId: "u1", userName: "測試" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws, "team_custom");
      ctx.broadcastToTeam("t-test", { type: "team_custom", data: "world" });

      const msg = await msgPromise;
      expect(msg.data).toBe("world");
    });
  });

  describe("連線關閉", () => {
    it("斷線時通知同 session 其他成員", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u1", userName: "玩家一" }));
      ws2.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "u2", userName: "玩家二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "user_left");
      ws2.close();

      const msg = await msgPromise;
      expect(msg.userId).toBe("u2");
    });
  });

  describe("認證驗證", () => {
    it("已認證的使用者不能冒用其他 userId", async () => {
      const ws = trackWs(await connectWs(port, "?token=valid-firebase-token"));

      const msgPromise = waitForMessage(ws, "error");
      ws.send(JSON.stringify({ type: "join", sessionId: "s1", userId: "different-user", userName: "冒名" }));

      const msg = await msgPromise;
      expect(msg.message).toContain("不符");
    });
  });

  describe("MQTT 整合", () => {
    it("setupWebSocket 有設定 MQTT hitBroadcastHandler", () => {
      expect(mockSetHitBroadcastHandler).toHaveBeenCalledTimes(1);
      expect(typeof mockSetHitBroadcastHandler.mock.calls[0][0]).toBe("function");
    });
  });
});
