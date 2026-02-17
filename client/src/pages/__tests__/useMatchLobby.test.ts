import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// --- Mock 宣告 ---
const mockSetLocation = vi.fn();
const mockToast = vi.fn();
const mockWs = {
  isConnected: false,
  ranking: [],
  countdown: null,
  matchStatus: null as string | null,
  lastEvent: null,
  sendMessage: vi.fn(),
};
const mockAuth = {
  user: { id: "user-1" },
  firebaseUser: { uid: "firebase-uid-1" },
  isLoading: false,
};

vi.mock("wouter", () => ({
  useParams: () => ({ gameId: "game-123" }),
  useLocation: () => ["/match/game-123", mockSetLocation],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/hooks/use-match-websocket", () => ({
  useMatchWebSocket: () => mockWs,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({}),
  }),
  queryClient: new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
}));

import { useMatchLobby } from "../match-lobby/useMatchLobby";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe("useMatchLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.isLoading = false;
    mockAuth.user = { id: "user-1" };
    mockAuth.firebaseUser = { uid: "firebase-uid-1" };
    mockWs.matchStatus = null;
    mockWs.isConnected = false;
    mockWs.ranking = [];
  });

  it("authLoading 時 currentView 為 loading", () => {
    mockAuth.isLoading = true;
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.currentView).toBe("loading");
  });

  it("無 currentMatchId 且 gameLoading 時 currentView 為 loading", () => {
    // useQuery 無 data 時 isLoading=true，故初始為 loading
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.currentView).toBe("loading");
  });

  it("isLoading 反映 authLoading 或 gameLoading", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    // gameQuery 無 data 時 isLoading=true
    expect(result.current.isLoading).toBe(true);
  });

  it("回傳 gameId", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.gameId).toBe("game-123");
  });

  it("matches 預設為空陣列", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.matches).toEqual([]);
  });

  it("currentUserId 優先使用 firebaseUser.uid", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.currentUserId).toBe("firebase-uid-1");
  });

  it("firebaseUser 為 null 時回退到 user.id", () => {
    mockAuth.firebaseUser = null as unknown as typeof mockAuth.firebaseUser;
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.currentUserId).toBe("user-1");
  });

  it("isCreator 在無 currentMatch 時為 false", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.isCreator).toBeFalsy();
  });

  it("回傳 mutation 函式", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(typeof result.current.createMatch).toBe("function");
    expect(typeof result.current.joinMatch).toBe("function");
    expect(typeof result.current.startMatch).toBe("function");
  });

  it("isPending 初始為 false", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.isCreating).toBe(false);
    expect(result.current.isJoining).toBe(false);
    expect(result.current.isStarting).toBe(false);
  });

  it("handleGoBack 導航到 /home", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    act(() => {
      result.current.handleGoBack();
    });
    expect(mockSetLocation).toHaveBeenCalledWith("/home");
  });

  it("ws 物件包含 sendMessage", () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    expect(result.current.ws).toBeDefined();
    expect(typeof result.current.ws.sendMessage).toBe("function");
  });
});
