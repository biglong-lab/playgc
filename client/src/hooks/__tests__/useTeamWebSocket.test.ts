import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- MockWebSocket ---
class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) { this.sentMessages.push(data); }
  close() { this.readyState = MockWebSocket.CLOSED; }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

import { useTeamWebSocket } from "../use-team-websocket";

const baseOpts = {
  teamId: "team-1",
  userId: "user-1",
  userName: "玩家1",
};

describe("useTeamWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    Object.defineProperty(window, "location", {
      value: { protocol: "http:", host: "localhost:3333" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- 連線管理 ---
  it("teamId 為 undefined 時不建立連線", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, teamId: undefined }));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("userId 為 undefined 時不建立連線", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, userId: undefined }));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("連線成功設 isConnected=true 並發送 team_join", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.isConnected).toBe(true);
    const ws = MockWebSocket.instances[0];
    const joinMsg = JSON.parse(ws.sentMessages[0]);
    expect(joinMsg.type).toBe("team_join");
    expect(joinMsg.teamId).toBe("team-1");
    expect(joinMsg.userId).toBe("user-1");
  });

  it("onclose 設 isConnected=false", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.isConnected).toBe(true);
    act(() => { MockWebSocket.instances[0].simulateClose(); });
    expect(result.current.isConnected).toBe(false);
  });

  it("unmount 呼叫 ws.close()", () => {
    const { unmount } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  // --- 接收訊息 ---
  it("team_member_joined 觸發 onMemberJoined", () => {
    const onMemberJoined = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberJoined }));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "team_member_joined", userId: "u2", userName: "玩家2",
      });
    });
    expect(onMemberJoined).toHaveBeenCalledWith("u2", "玩家2");
  });

  it("team_member_left 觸發 onMemberLeft 並刪除位置", () => {
    const onMemberLeft = vi.fn();
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberLeft }));
    act(() => { vi.advanceTimersByTime(10); });
    const ws = MockWebSocket.instances[0];

    // 先加入位置
    act(() => {
      ws.simulateMessage({
        type: "team_location", userId: "u2", userName: "P2",
        latitude: 25.0, longitude: 121.5, accuracy: 10,
      });
    });
    expect(result.current.memberLocations.has("u2")).toBe(true);

    // 離開後刪除
    act(() => {
      ws.simulateMessage({ type: "team_member_left", userId: "u2", userName: "P2" });
    });
    expect(onMemberLeft).toHaveBeenCalledWith("u2", "P2");
    expect(result.current.memberLocations.has("u2")).toBe(false);
  });

  it("team_location 更新 memberLocations Map", () => {
    const onLocationUpdate = vi.fn();
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, onLocationUpdate }));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "team_location", userId: "u3", userName: "P3",
        latitude: 25.05, longitude: 121.55, accuracy: 5,
      });
    });
    const loc = result.current.memberLocations.get("u3");
    expect(loc?.latitude).toBe(25.05);
    expect(loc?.longitude).toBe(121.55);
    expect(onLocationUpdate).toHaveBeenCalled();
  });

  it("team_vote_cast 觸發 onVoteCast", () => {
    const onVoteCast = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onVoteCast }));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "team_vote_cast", voteId: "v1", pageId: "p1", userId: "u1", choice: "A",
      });
    });
    expect(onVoteCast).toHaveBeenCalledWith("v1", "p1", "u1", "A");
  });

  it("team_score_update 觸發 onScoreUpdate", () => {
    const onScoreUpdate = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onScoreUpdate }));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "team_score_update", score: 150, change: 50, reason: "答對問題",
      });
    });
    expect(onScoreUpdate).toHaveBeenCalledWith(150, 50, "答對問題");
  });

  it("team_ready_update 觸發 onReadyUpdate", () => {
    const onReadyUpdate = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onReadyUpdate }));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => {
      MockWebSocket.instances[0].simulateMessage({
        type: "team_ready_update", userId: "u2", isReady: true,
      });
    });
    expect(onReadyUpdate).toHaveBeenCalledWith("u2", true);
  });

  it("無效 JSON 不崩潰", () => {
    renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    const ws = MockWebSocket.instances[0];
    expect(() => {
      ws.onmessage?.({ data: "not valid json {{{" });
    }).not.toThrow();
  });

  // --- 發送訊息 ---
  it("sendChat 發送正確 JSON", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => { result.current.sendChat("你好", "text"); });
    const ws = MockWebSocket.instances[0];
    const msg = JSON.parse(ws.sentMessages[1]); // [0] 是 team_join
    expect(msg.type).toBe("team_chat");
    expect(msg.message).toBe("你好");
  });

  it("sendLocation 發送座標", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => { result.current.sendLocation(25.0, 121.5, 10); });
    const msg = JSON.parse(MockWebSocket.instances[0].sentMessages[1]);
    expect(msg.type).toBe("team_location");
    expect(msg.latitude).toBe(25.0);
    expect(msg.longitude).toBe(121.5);
  });

  it("sendVote 發送投票", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => { result.current.sendVote("v1", "p1", "B"); });
    const msg = JSON.parse(MockWebSocket.instances[0].sentMessages[1]);
    expect(msg.type).toBe("team_vote");
    expect(msg.choice).toBe("B");
  });

  it("sendReady 發送準備狀態", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => { vi.advanceTimersByTime(10); });
    act(() => { result.current.sendReady(true); });
    const msg = JSON.parse(MockWebSocket.instances[0].sentMessages[1]);
    expect(msg.type).toBe("team_ready");
    expect(msg.isReady).toBe(true);
  });

  it("初始 state 正確", () => {
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, teamId: undefined }));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.memberLocations.size).toBe(0);
  });
});
