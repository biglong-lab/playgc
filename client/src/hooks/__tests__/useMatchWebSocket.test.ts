import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock firebase getIdToken
vi.mock("@/lib/firebase", () => ({
  getIdToken: vi.fn().mockResolvedValue("mock-token"),
}));

// --- MockWebSocket ---
type WsHandler = ((event: { data: string }) => void) | null;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: WsHandler = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // 模擬非同步 onopen
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // 測試工具：模擬收到訊息
  simulateMessage(data: Record<string, unknown>) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  // 測試工具：模擬斷線
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
}

// 加入 OPEN 常數
Object.defineProperty(MockWebSocket, "OPEN", { value: 1 });
Object.defineProperty(MockWebSocket, "CLOSED", { value: 3 });

import { useMatchWebSocket } from "../use-match-websocket";

describe("useMatchWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    // 模擬 window.location
    Object.defineProperty(window, "location", {
      value: { protocol: "http:", host: "localhost:3333" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("matchId=null 不建立連線", () => {
    renderHook(() => useMatchWebSocket(null));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("有 matchId 時建立 WebSocket 連線", async () => {
    renderHook(() => useMatchWebSocket("match-1"));
    // getIdToken 是 async，需要等待
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1);
  });

  it("連線成功後 isConnected=true", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("連線後自動發送 match_join", async () => {
    renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];
    const joinMsg = ws.sentMessages.find(
      (m) => JSON.parse(m).type === "match_join",
    );
    expect(joinMsg).toBeDefined();
    expect(JSON.parse(joinMsg!).matchId).toBe("match-1");
  });

  it("match_ranking 消息更新 ranking", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({
        type: "match_ranking",
        ranking: [{ userId: "u1", score: 100, rank: 1 }],
      });
    });

    expect(result.current.ranking).toHaveLength(1);
    expect(result.current.ranking[0].userId).toBe("u1");
  });

  it("match_countdown 啟動前端倒數", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "match_countdown", seconds: 3 });
    });

    expect(result.current.matchStatus).toBe("countdown");
    expect(result.current.countdown).toBe(3);
  });

  it("倒數遞減", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "match_countdown", seconds: 3 });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(2);
  });

  it("倒數到 0 發送 match_countdown_complete", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "match_countdown", seconds: 2 });
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.countdown).toBe(0);
    const completeMsg = ws.sentMessages.find(
      (m) => JSON.parse(m).type === "match_countdown_complete",
    );
    expect(completeMsg).toBeDefined();
  });

  it("match_started 設 matchStatus=playing", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "match_started" });
    });

    expect(result.current.matchStatus).toBe("playing");
    expect(result.current.countdown).toBeNull();
  });

  it("match_finished 設 matchStatus=finished + 更新排名", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({
        type: "match_finished",
        ranking: [{ userId: "u1", score: 200, rank: 1 }],
      });
    });

    expect(result.current.matchStatus).toBe("finished");
    expect(result.current.ranking).toHaveLength(1);
  });

  it("relay_handoff 更新 lastEvent", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "relay_handoff", segment: 2 });
    });

    expect(result.current.lastEvent).toEqual({ type: "relay_handoff", segment: 2 });
  });

  it("sendMessage 發送 JSON 訊息", async () => {
    const { result } = renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    act(() => {
      result.current.sendMessage({ type: "test_msg", data: 42 });
    });

    const ws = MockWebSocket.instances[0];
    const sent = ws.sentMessages.find((m) => JSON.parse(m).type === "test_msg");
    expect(sent).toBeDefined();
  });

  it("初始 state 正確", () => {
    const { result } = renderHook(() => useMatchWebSocket(null));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.ranking).toEqual([]);
    expect(result.current.countdown).toBeNull();
    expect(result.current.matchStatus).toBeNull();
    expect(result.current.lastEvent).toBeNull();
  });

  it("URL 包含 token 參數", async () => {
    renderHook(() => useMatchWebSocket("match-1"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("token=mock-token");
    expect(ws.url).toContain("ws://localhost:3333/ws");
  });
});
