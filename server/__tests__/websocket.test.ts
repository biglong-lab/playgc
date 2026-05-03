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

    // 🆕 Phase 2a：socket close → 廣播 disconnected（不是 left）
    it("socket close 後廣播 team_member_disconnected（暫時離線）", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t2", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t2", userId: "u2", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_member_disconnected");
      ws2.close();
      const msg = await msgPromise;
      expect(msg.userId).toBe("u2");
      expect(msg.type).toBe("team_member_disconnected");
    });

    // 🆕 Phase 2a：曾連過再連 → 廣播 reconnected
    it("曾連過後重連 → 廣播 team_member_reconnected", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t3", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t3", userId: "u2", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      // u2 斷線
      ws2.close();
      await new Promise((r) => setTimeout(r, 100));

      // u2 重連
      const ws2b = trackWs(await connectWs(port));
      const msgPromise = waitForMessage(ws1, "team_member_reconnected");
      ws2b.send(JSON.stringify({ type: "team_join", teamId: "t3", userId: "u2", userName: "成員二" }));

      const msg = await msgPromise;
      expect(msg.userId).toBe("u2");
      expect(msg.type).toBe("team_member_reconnected");
    });
  });

  describe("team_chat", () => {
    it("團隊聊天訊息廣播（必須認證、用 server 端 userId 防偽造）", async () => {
      const ws1 = trackWs(await connectWs(port));
      // ws2 帶 token、authenticatedUserId 會被設為 firebase-user-1
      const ws2 = trackWs(await connectWs(port, "?token=valid-firebase-token"));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "firebase-user-1", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_chat");
      ws2.send(JSON.stringify({
        type: "team_chat",
        userId: "fake-user", // 攻擊者偽造、應該被忽略
        userName: "fake",
        message: "你好！",
      }));

      const msg = await msgPromise;
      expect(msg.message).toBe("你好！");
      // 廣播的 userId 用 server 端 authenticatedUserId、不是 client 傳的偽造值
      expect(msg.userId).toBe("firebase-user-1");
    });

    it("未認證 ws 送 team_chat → silent drop", async () => {
      const ws1 = trackWs(await connectWs(port)); // 接收用
      const ws2 = trackWs(await connectWs(port)); // 無 token

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u2", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      // ws2 未認證、送 team_chat 應被 silent drop
      ws2.send(JSON.stringify({
        type: "team_chat",
        userId: "u2",
        userName: "成員二",
        message: "假訊息",
      }));

      // 等 200ms 確認 ws1 沒收到（silent drop）
      let received = false;
      ws1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "team_chat") received = true;
      });
      await new Promise((r) => setTimeout(r, 200));
      expect(received).toBe(false);
    });
  });

  describe("team_ready", () => {
    it("準備狀態廣播（必須認證、用 server 端 userId）", async () => {
      const ws1 = trackWs(await connectWs(port));
      const ws2 = trackWs(await connectWs(port, "?token=valid-firebase-token"));

      ws1.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "u1", userName: "成員一" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "t1", userId: "firebase-user-1", userName: "成員二" }));
      await new Promise((r) => setTimeout(r, 100));

      const msgPromise = waitForMessage(ws1, "team_ready_update");
      ws2.send(JSON.stringify({
        type: "team_ready",
        userId: "fake-user", // 偽造
        userName: "fake",
        isReady: true,
      }));

      const msg = await msgPromise;
      expect(msg.isReady).toBe(true);
      expect(msg.userId).toBe("firebase-user-1");
    });
  });

  // ⚠️ "chat（session 聊天）" describe 已移除（commit ba0872f9 P0 修）
  //   原因：server WS case "chat" 整段已刪除（之前同 client REST POST /api/chat 雙寫 DB + 繞過 auth/limit）
  //   chat 寫入測試請查 player-sessions REST handler；廣播由 ctx.broadcastToSession 完成（見下面測試）

  describe("WS rate limit (ADR-0015)", () => {
    it("超過 10 個訊息/秒 → silent drop（不影響其他正常玩家）", async () => {
      const ws1 = trackWs(await connectWs(port)); // 接收方
      const ws2 = trackWs(await connectWs(port, "?token=valid-firebase-token")); // 灌訊息方

      ws1.send(JSON.stringify({ type: "team_join", teamId: "rt", userId: "u1", userName: "接收" }));
      ws2.send(JSON.stringify({ type: "team_join", teamId: "rt", userId: "firebase-user-1", userName: "灌訊息" }));
      await new Promise((r) => setTimeout(r, 100));

      // 1 秒內快速送 30 個 team_chat
      // 前 9 個應該成功（join 占用 1 個額度）、之後 silent drop
      const receivedCount: { count: number } = { count: 0 };
      ws1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "team_chat") receivedCount.count++;
      });

      for (let i = 0; i < 30; i++) {
        ws2.send(JSON.stringify({
          type: "team_chat",
          message: `flood-${i}`,
        }));
      }
      // 等所有訊息傳完
      await new Promise((r) => setTimeout(r, 500));

      // 接收量 < 30（被 rate limit 擋掉一部分）
      expect(receivedCount.count).toBeLessThan(30);
      // 至少收到一些（不是完全擋掉）
      expect(receivedCount.count).toBeGreaterThan(0);
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
