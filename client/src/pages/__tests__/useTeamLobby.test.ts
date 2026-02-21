import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// --- Mock 宣告 ---
const mockSetLocation = vi.fn();
const mockToast = vi.fn();
const mockWsCallbacks: Record<string, (...args: unknown[]) => void> = {};
const mockWs = {
  isConnected: false,
};

const mockAuth = {
  user: { id: "user-1", firstName: "測試", email: "test@example.com" } as Record<string, unknown> | null,
  firebaseUser: { uid: "firebase-uid-1" },
  isLoading: false,
};

vi.mock("wouter", () => ({
  useParams: () => ({ gameId: "game-123" }),
  useLocation: () => ["/team/game-123", mockSetLocation],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/hooks/use-team-websocket", () => ({
  useTeamWebSocket: (opts: Record<string, unknown>) => {
    // 保存 callbacks 以便測試中呼叫
    if (opts.onMemberJoined) mockWsCallbacks.onMemberJoined = opts.onMemberJoined as (...args: unknown[]) => void;
    if (opts.onMemberLeft) mockWsCallbacks.onMemberLeft = opts.onMemberLeft as (...args: unknown[]) => void;
    if (opts.onReadyUpdate) mockWsCallbacks.onReadyUpdate = opts.onReadyUpdate as (...args: unknown[]) => void;
    return mockWs;
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockApiRequest = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({}),
});

const mockInvalidateQueries = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  },
}));

import { useTeamLobby } from "../team-lobby/useTeamLobby";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("useTeamLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = { id: "user-1", firstName: "測試", email: "test@example.com" };
    mockAuth.isLoading = false;
    mockWs.isConnected = false;
    mockApiRequest.mockResolvedValue({
      json: () => Promise.resolve({}),
    });
  });

  it("初始化返回正確預設狀態", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.accessCode).toBe("");
    expect(result.current.teamName).toBe("");
    expect(result.current.showJoinForm).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it("currentUserId 來自 dbUser.id", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.currentUserId).toBe("user-1");
  });

  it("user 為 null 時 currentUserId 為 undefined", () => {
    mockAuth.user = null;
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.currentUserId).toBeUndefined();
  });

  it("gameLoading 初始為 true（無資料時）", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.gameLoading).toBe(true);
  });

  it("teamLoading 初始為 true（無資料時）", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.teamLoading).toBe(true);
  });

  it("myTeam 初始為 undefined", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.myTeam).toBeUndefined();
  });

  it("無隊伍時 isLeader 為 false", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.isLeader).toBe(false);
  });

  it("無隊伍時 allReady 為 false", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.allReady).toBe(false);
  });

  it("無隊伍時 hasEnoughPlayers 為 false", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.hasEnoughPlayers).toBe(false);
  });

  it("mutation pending 狀態初始為 false", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.createPending).toBe(false);
    expect(result.current.joinPending).toBe(false);
    expect(result.current.readyPending).toBe(false);
    expect(result.current.startPending).toBe(false);
    expect(result.current.leavePending).toBe(false);
  });

  it("setAccessCode 更新 accessCode", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.setAccessCode("ABC123");
    });
    expect(result.current.accessCode).toBe("ABC123");
  });

  it("setTeamName 更新 teamName", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.setTeamName("我的隊伍");
    });
    expect(result.current.teamName).toBe("我的隊伍");
  });

  it("setShowJoinForm 切換顯示狀態", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.setShowJoinForm(true);
    });
    expect(result.current.showJoinForm).toBe(true);
    act(() => {
      result.current.setShowJoinForm(false);
    });
    expect(result.current.showJoinForm).toBe(false);
  });

  it("handleJoinTeam 空 accessCode 時顯示 toast 錯誤", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.handleJoinTeam();
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "請輸入組隊碼", variant: "destructive" }),
    );
  });

  it("handleJoinTeam 有 accessCode 時呼叫 API", async () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.setAccessCode("abc123");
    });
    act(() => {
      result.current.handleJoinTeam();
    });
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/teams/join",
        { accessCode: "ABC123" },
      );
    });
  });

  it("handleCreateTeam 呼叫 API 建立隊伍", async () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.setTeamName("好棒隊");
    });
    act(() => {
      result.current.handleCreateTeam();
    });
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/games/game-123/teams",
        { name: "好棒隊" },
      );
    });
  });

  it("navigate 呼叫 setLocation", () => {
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.navigate("/home");
    });
    expect(mockSetLocation).toHaveBeenCalledWith("/home");
  });

  it("wsConnected 反映 WebSocket 連線狀態", () => {
    mockWs.isConnected = true;
    const { result } = renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    expect(result.current.wsConnected).toBe(true);
  });

  it("onMemberJoined callback 顯示 toast 並刷新隊伍", () => {
    renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      mockWsCallbacks.onMemberJoined?.("user-2", "小明");
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "小明 加入了隊伍" }),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["/api/games", "game-123", "my-team"] }),
    );
  });

  it("onMemberLeft callback 顯示 toast 並刷新隊伍", () => {
    renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      mockWsCallbacks.onMemberLeft?.("user-2", "小華");
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "小華 離開了隊伍" }),
    );
  });

  it("onReadyUpdate callback 刷新隊伍查詢", () => {
    renderHook(() => useTeamLobby(), { wrapper: createWrapper() });
    act(() => {
      mockWsCallbacks.onReadyUpdate?.();
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["/api/games", "game-123", "my-team"] }),
    );
  });
});
