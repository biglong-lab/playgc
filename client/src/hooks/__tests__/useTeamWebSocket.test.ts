/**
 * useTeamWebSocket 測試 — 薄封裝行為驗證
 *
 * 2026-05-08 WebSocket 重構後，useTeamWebSocket 不再自己 new WebSocket，
 * 改為透過全域 WebSocketProvider 的 acquire / subscribe / send。
 * 因此本檔測的是「薄封裝是否正確」：
 *   - teamId / userId / userName 缺一時不 acquire
 *   - 有值時 acquire 帶正確參數
 *   - subscribe 收到各類型訊息時分發到對應 callback
 *   - isConnected / isReconnecting / getConnectionStats 透傳 Provider
 *   - send* 系列函式組出正確 payload 丟給 Provider 的 send
 *
 * 舊測試裡「連線建立 / onclose / 重連 / unmount close」等行為已移交
 * WebSocketProvider（client/src/contexts/WebSocketContext.tsx）管理，
 * 不屬於此 hook 職責，故不在本檔測（歸 Provider 的測試範圍）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TeamMessage, ConnectionStats } from "@/contexts/WebSocketContext";

// ==================== Provider mock ====================
// 用 vi.hoisted 讓 vi.mock factory 拿得到同一份 mock 實體
const providerMock = vi.hoisted(() => {
  // subscribe 註冊進來的 handlers（測試用 emit() 派發訊息）
  const subscribers = new Set<(msg: { type: string } & Record<string, unknown>) => void>();
  const state = { isConnected: true, isReconnecting: false };
  const stats = {
    connectAt: 0,
    disconnectCount: 0,
    reconnectSuccessCount: 0,
    reconnectFailCount: 0,
    isConnected: true,
    isReconnecting: false,
    currentAttempts: 0,
  };
  const acquireRelease = vi.fn();
  return {
    subscribers,
    state,
    stats,
    acquireRelease,
    acquire: vi.fn(() => acquireRelease),
    ensureConnected: vi.fn(() => () => undefined),
    registerOnConnect: vi.fn(() => () => undefined),
    subscribe: vi.fn((handler: (msg: { type: string } & Record<string, unknown>) => void) => {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    }),
    send: vi.fn(() => true),
    getConnectionStats: vi.fn(() => stats),
  };
});

vi.mock("@/contexts/WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: providerMock.state.isConnected,
    isReconnecting: providerMock.state.isReconnecting,
    acquire: providerMock.acquire,
    ensureConnected: providerMock.ensureConnected,
    registerOnConnect: providerMock.registerOnConnect,
    subscribe: providerMock.subscribe,
    send: providerMock.send,
    getConnectionStats: providerMock.getConnectionStats,
  }),
}));

import { useTeamWebSocket } from "../use-team-websocket";

/** 模擬 Provider 廣播一則訊息給所有 subscriber */
function emit(msg: TeamMessage): void {
  act(() => {
    providerMock.subscribers.forEach((handler) => handler(msg));
  });
}

const baseOpts = {
  teamId: "team-1",
  userId: "user-1",
  userName: "玩家1",
};

describe("useTeamWebSocket（薄封裝）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMock.subscribers.clear();
    providerMock.state.isConnected = true;
    providerMock.state.isReconnecting = false;
  });

  // ==================== acquire 行為 ====================
  it("teamId 為 undefined 時不 acquire", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, teamId: undefined }));
    expect(providerMock.acquire).not.toHaveBeenCalled();
  });

  it("userId 為 undefined 時不 acquire", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, userId: undefined }));
    expect(providerMock.acquire).not.toHaveBeenCalled();
  });

  it("userName 為 undefined 時不 acquire", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, userName: undefined }));
    expect(providerMock.acquire).not.toHaveBeenCalled();
  });

  it("三值齊全時 acquire 帶正確參數", () => {
    renderHook(() => useTeamWebSocket(baseOpts));
    expect(providerMock.acquire).toHaveBeenCalledTimes(1);
    expect(providerMock.acquire).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-1",
      userName: "玩家1",
      alsoJoinSessionId: undefined,
    });
  });

  it("有 alsoJoinSessionId 時一併傳給 acquire", () => {
    renderHook(() => useTeamWebSocket({ ...baseOpts, alsoJoinSessionId: "session-9" }));
    expect(providerMock.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ alsoJoinSessionId: "session-9" }),
    );
  });

  it("unmount 時呼叫 acquire 回傳的 release", () => {
    const { unmount } = renderHook(() => useTeamWebSocket(baseOpts));
    unmount();
    expect(providerMock.acquireRelease).toHaveBeenCalledTimes(1);
  });

  // ==================== 狀態透傳 ====================
  it("isConnected / isReconnecting 透傳 Provider 狀態", () => {
    providerMock.state.isConnected = true;
    providerMock.state.isReconnecting = false;
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isReconnecting).toBe(false);
  });

  it("Provider 斷線時 isConnected 透傳為 false", () => {
    providerMock.state.isConnected = false;
    providerMock.state.isReconnecting = true;
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(true);
  });

  it("getConnectionStats 透傳 Provider 統計", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    const stats: ConnectionStats = result.current.getConnectionStats();
    expect(providerMock.getConnectionStats).toHaveBeenCalled();
    expect(stats).toEqual(providerMock.stats);
  });

  // ==================== 訊息分發 ====================
  it("subscribe 在 mount 時註冊、unmount 時取消", () => {
    const { unmount } = renderHook(() => useTeamWebSocket(baseOpts));
    expect(providerMock.subscribe).toHaveBeenCalledTimes(1);
    expect(providerMock.subscribers.size).toBe(1);
    unmount();
    expect(providerMock.subscribers.size).toBe(0);
  });

  it("任何訊息都會觸發 onMessage", () => {
    const onMessage = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onMessage }));
    emit({ type: "some_unknown_type", userId: "u9" });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "some_unknown_type" }),
    );
  });

  it("team_member_joined 分發到 onMemberJoined", () => {
    const onMemberJoined = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberJoined }));
    emit({ type: "team_member_joined", userId: "u2", userName: "玩家2" });
    expect(onMemberJoined).toHaveBeenCalledWith("u2", "玩家2");
  });

  it("team_member_left 分發到 onMemberLeft 並刪除該員位置", () => {
    const onMemberLeft = vi.fn();
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberLeft }));

    // 先塞一筆位置
    emit({
      type: "team_location",
      userId: "u2",
      userName: "P2",
      latitude: 25.0,
      longitude: 121.5,
      accuracy: 10,
    });
    expect(result.current.memberLocations.has("u2")).toBe(true);

    // 離開後刪除
    emit({ type: "team_member_left", userId: "u2", userName: "P2" });
    expect(onMemberLeft).toHaveBeenCalledWith("u2", "P2");
    expect(result.current.memberLocations.has("u2")).toBe(false);
  });

  it("team_member_disconnected 分發到 onMemberDisconnected", () => {
    const onMemberDisconnected = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberDisconnected }));
    emit({ type: "team_member_disconnected", userId: "u3", userName: "P3" });
    expect(onMemberDisconnected).toHaveBeenCalledWith("u3", "P3");
  });

  it("team_member_reconnected 分發到 onMemberReconnected", () => {
    const onMemberReconnected = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onMemberReconnected }));
    emit({ type: "team_member_reconnected", userId: "u3", userName: "P3" });
    expect(onMemberReconnected).toHaveBeenCalledWith("u3", "P3");
  });

  it("team_location 更新 memberLocations 並觸發 onLocationUpdate", () => {
    const onLocationUpdate = vi.fn();
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, onLocationUpdate }));
    emit({
      type: "team_location",
      userId: "u3",
      userName: "P3",
      latitude: 25.05,
      longitude: 121.55,
      accuracy: 5,
    });
    const loc = result.current.memberLocations.get("u3");
    expect(loc?.latitude).toBe(25.05);
    expect(loc?.longitude).toBe(121.55);
    expect(onLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u3", latitude: 25.05 }),
    );
  });

  it("team_vote_cast 分發到 onVoteCast", () => {
    const onVoteCast = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onVoteCast }));
    emit({ type: "team_vote_cast", voteId: "v1", pageId: "p1", userId: "u1", choice: "A" });
    expect(onVoteCast).toHaveBeenCalledWith("v1", "p1", "u1", "A");
  });

  it("team_score_update 分發到 onScoreUpdate", () => {
    const onScoreUpdate = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onScoreUpdate }));
    emit({ type: "team_score_update", score: 150, change: 50, reason: "答對問題" });
    expect(onScoreUpdate).toHaveBeenCalledWith(150, 50, "答對問題");
  });

  it("team_ready_update 分發到 onReadyUpdate", () => {
    const onReadyUpdate = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onReadyUpdate }));
    emit({ type: "team_ready_update", userId: "u2", isReady: true });
    expect(onReadyUpdate).toHaveBeenCalledWith("u2", true);
  });

  it("game_started 分發到 onGameStarted", () => {
    const onGameStarted = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onGameStarted }));
    emit({ type: "game_started", sessionId: "s1", gameId: "g1" });
    expect(onGameStarted).toHaveBeenCalledWith("s1", "g1");
  });

  it("team_progress_advance 分發到 onProgressAdvance", () => {
    const onProgressAdvance = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onProgressAdvance }));
    emit({ type: "team_progress_advance", maxPageIndex: 7, advancedBy: "u2" });
    expect(onProgressAdvance).toHaveBeenCalledWith(7, "u2");
  });

  it("team_member_grace_expired 分發到 onGraceExpired（無 autoLeaveInMs 時預設 120000）", () => {
    const onGraceExpired = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onGraceExpired }));
    emit({ type: "team_member_grace_expired", userId: "u2", userName: "P2" });
    expect(onGraceExpired).toHaveBeenCalledWith("u2", "P2", 120_000);
  });

  it("team_leader_decide 分發到 onLeaderDecide", () => {
    const onLeaderDecide = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onLeaderDecide }));
    emit({
      type: "team_leader_decide",
      action: "continue",
      targetUserId: "u2",
      leaderUserId: "u1",
    });
    expect(onLeaderDecide).toHaveBeenCalledWith("continue", "u2", "u1");
  });

  it("ready_status_changed 分發到 onReadyStatusChanged（帶完整 team 物件）", () => {
    const onReadyStatusChanged = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onReadyStatusChanged }));
    const team = { id: "team-1", members: [] };
    emit({ type: "ready_status_changed", team });
    expect(onReadyStatusChanged).toHaveBeenCalledWith(team);
  });

  it("team_kicked 分發到 onSelfKicked（無 reason 時預設 left_team）", () => {
    const onSelfKicked = vi.fn();
    renderHook(() => useTeamWebSocket({ ...baseOpts, onSelfKicked }));
    emit({ type: "team_kicked" });
    expect(onSelfKicked).toHaveBeenCalledWith("left_team");
  });

  // ==================== send 系列 ====================
  it("sendChat 透過 Provider send 發送正確 payload", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => {
      result.current.sendChat("你好", "text");
    });
    expect(providerMock.send).toHaveBeenCalledWith({
      type: "team_chat",
      userId: "user-1",
      userName: "玩家1",
      message: "你好",
      messageType: "text",
    });
  });

  it("sendChat 在 teamId 為 undefined 時不發送", () => {
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, teamId: undefined }));
    act(() => {
      result.current.sendChat("你好");
    });
    expect(providerMock.send).not.toHaveBeenCalled();
  });

  it("sendLocation 發送座標", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => {
      result.current.sendLocation(25.0, 121.5, 10);
    });
    expect(providerMock.send).toHaveBeenCalledWith({
      type: "team_location",
      userId: "user-1",
      userName: "玩家1",
      latitude: 25.0,
      longitude: 121.5,
      accuracy: 10,
    });
  });

  it("sendVote 發送投票", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => {
      result.current.sendVote("v1", "p1", "B");
    });
    expect(providerMock.send).toHaveBeenCalledWith({
      type: "team_vote",
      voteId: "v1",
      pageId: "p1",
      userId: "user-1",
      userName: "玩家1",
      choice: "B",
    });
  });

  it("sendReady 發送準備狀態", () => {
    const { result } = renderHook(() => useTeamWebSocket(baseOpts));
    act(() => {
      result.current.sendReady(true);
    });
    expect(providerMock.send).toHaveBeenCalledWith({
      type: "team_ready",
      userId: "user-1",
      userName: "玩家1",
      isReady: true,
    });
  });

  it("初始 memberLocations 為空 Map", () => {
    const { result } = renderHook(() => useTeamWebSocket({ ...baseOpts, teamId: undefined }));
    expect(result.current.memberLocations.size).toBe(0);
  });
});
