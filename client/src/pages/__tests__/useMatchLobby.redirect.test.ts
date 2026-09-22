// 🐛 競賽／接力模式開賽後必須導向遊戲頁（之前 PlayingView 只顯示排名、玩家看不到任何關卡）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// --- Mock 宣告 ---
const mockSetLocation = vi.fn();
const mockWs = {
  isConnected: true,
  ranking: [],
  countdown: null,
  matchStatus: null as string | null,
  lastEvent: null,
  sendMessage: vi.fn(),
};
const mockField: { code: string } | null = { code: "HPSPACE" };
const mockApiRequest = vi.fn();

vi.mock("wouter", () => ({
  useParams: () => ({ gameId: "game-123" }),
  useLocation: () => ["/f/HPSPACE/match/game-123", mockSetLocation],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    firebaseUser: { uid: "user-1" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-match-websocket", () => ({
  useMatchWebSocket: () => mockWs,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/providers/FieldThemeProvider", () => ({
  useCurrentField: () => mockField,
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
}));

import { useMatchLobby } from "../match-lobby/useMatchLobby";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        // 預設 queryFn：遊戲資訊（["/api/games", gameId]）
        queryFn: async () => ({ id: "game-123", title: "測試賽", gameMode: "competitive" }),
      },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

/** 模擬 apiRequest：GET 對戰詳情回傳指定狀態，其餘回空物件 */
function mockMatchApi(matchStatus: string) {
  mockApiRequest.mockImplementation(async (method: string, url: string) => ({
    json: async () => {
      if (method === "GET" && url === "/api/matches/match-9") {
        return { id: "match-9", status: matchStatus, participants: [] };
      }
      if (method === "GET") return [];
      return {};
    },
  }));
}

async function joinMatch(result: { current: ReturnType<typeof useMatchLobby> }) {
  await waitFor(() => expect(result.current.currentView).toBe("browse"));
  act(() => {
    result.current.joinMatch("match-9");
  });
  await waitFor(() => expect(result.current.currentMatchId).toBe("match-9"));
}

describe("useMatchLobby — 開賽後導向遊戲頁", () => {
  beforeEach(() => {
    mockSetLocation.mockReset();
    mockApiRequest.mockReset();
    mockWs.matchStatus = null;
  });

  it("WS 通知 match_started（playing）→ 導向 /f/{fieldCode}/game/:gameId", async () => {
    mockMatchApi("countdown");
    const { result, rerender } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    await joinMatch(result);
    expect(mockSetLocation).not.toHaveBeenCalledWith(expect.stringContaining("/game/"));

    mockWs.matchStatus = "playing";
    rerender();

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/game/game-123");
    });
  });

  it("WS 斷線但輪詢到 status=playing 也要導向遊戲頁", async () => {
    mockMatchApi("playing");
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    await joinMatch(result);

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/game/game-123");
    });
  });

  it("等待中（waiting）不導向", async () => {
    mockMatchApi("waiting");
    const { result } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    await joinMatch(result);
    await waitFor(() => expect(result.current.currentView).toBe("waiting"));
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("只導向一次（重繪不重複 setLocation）", async () => {
    mockMatchApi("playing");
    const { result, rerender } = renderHook(() => useMatchLobby(), { wrapper: createWrapper() });
    await joinMatch(result);
    await waitFor(() => expect(mockSetLocation).toHaveBeenCalledTimes(1));
    mockWs.matchStatus = "playing";
    rerender();
    rerender();
    expect(mockSetLocation).toHaveBeenCalledTimes(1);
  });
});
