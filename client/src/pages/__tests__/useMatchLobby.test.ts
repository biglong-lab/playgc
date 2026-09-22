// 🏁 useMatchLobby（2026-09-23 P1 重寫）：賽事 ID 進網址、邀請碼加入、開賽導向遊戲頁（只導參賽者）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

const mockSetLocation = vi.fn();
let mockSearch = "";
const mockWs = { isConnected: true, ranking: [], countdown: null, matchStatus: null as string | null, lastEvent: null, sendMessage: vi.fn() };
const mockApiRequest = vi.fn();
const routes: Record<string, unknown> = {};

vi.mock("wouter", () => ({
  useParams: () => ({ gameId: "game-123" }),
  useLocation: () => ["/f/HPSPACE/match/game-123", mockSetLocation],
  useSearch: () => mockSearch,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, firebaseUser: { uid: "user-1", isAnonymous: true }, isLoading: false }),
}));
vi.mock("@/hooks/use-match-websocket", () => ({ useMatchWebSocket: () => mockWs }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/providers/FieldThemeProvider", () => ({ useCurrentField: () => ({ code: "HPSPACE" }) }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: new QueryClient(),
}));

import { useMatchLobby } from "../match-lobby/useMatchLobby";

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async ({ queryKey }) => routes[(queryKey as string[]).join("/")] ?? null,
      },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function detail(status: string, userIds: string[] = ["user-1"]) {
  return {
    id: "match-9", gameId: "game-123", matchMode: "competitive", status, accessCode: "ABCD23", creatorId: "user-1",
    minParticipants: 2, maxParticipants: 10, countdownSeconds: 3, timeLimitSeconds: null, relayLegs: [], teamTotal: null,
    ranking: userIds.map((u, i) => ({ participantId: `p${i}`, userId: u, displayName: u, score: 0, rank: i + 1, completed: false })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch = "";
  mockWs.matchStatus = null;
  for (const k of Object.keys(routes)) delete routes[k];
  routes["/api/games/game-123"] = { id: "game-123", title: "測試賽", gameMode: "competitive" };
  routes["/api/games/game-123/matches"] = [];
  routes["/api/games/game-123/matches/mine"] = null;
  mockApiRequest.mockResolvedValue({ json: async () => ({}) });
});

describe("useMatchLobby", () => {
  it("沒有賽事 → 列表畫面；lobbyPath 帶場域前綴", async () => {
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("browse"));
    expect(result.current.lobbyPath).toBe("/f/HPSPACE/match/game-123");
  });

  it("網址帶 ?m= → 直接顯示那場（重整找得回來）", async () => {
    mockSearch = "?m=match-9";
    routes["/api/matches/match-9"] = detail("waiting");
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("waiting"));
    expect(result.current.isCreator).toBe(true);
  });

  it("沒帶 ?m= 但我有進行中賽事 → 寫回網址", async () => {
    routes["/api/games/game-123/matches/mine"] = { id: "match-9", status: "waiting" };
    routes["/api/matches/match-9"] = detail("waiting");
    renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() =>
      expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/match/game-123?m=match-9", { replace: true }),
    );
  });

  it("分享連結 ?code= → 自動用邀請碼加入一次，成功後進到那場", async () => {
    mockSearch = "?code=abcd23";
    mockApiRequest.mockResolvedValue({ json: async () => ({ matchId: "match-9" }) });
    renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith("POST", "/api/games/game-123/matches/join-by-code", expect.objectContaining({ code: "ABCD23" })),
    );
    await waitFor(() => expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/match/game-123?m=match-9", { replace: true }));
    expect(mockApiRequest.mock.calls.filter(([, url]) => String(url).includes("join-by-code"))).toHaveLength(1);
  });

  it("建立賽事 → 帶訪客暱稱、成功後進到那場", async () => {
    // 測試環境的 localStorage 是 vi.fn stub → 指定回傳訪客暱稱
    vi.mocked(localStorage.getItem).mockImplementation((k: string) => (k === "anonymous_player_name" ? "探險家1234" : null));
    mockApiRequest.mockResolvedValue({ json: async () => ({ id: "match-new" }) });
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("browse"));
    act(() => result.current.createMatch());
    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith("POST", "/api/games/game-123/matches", { playerName: "探險家1234" }),
    );
    await waitFor(() => expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/match/game-123?m=match-new", { replace: true }));
  });

  it("開賽（輪詢到 playing）→ 參賽者導向遊戲頁、帶 ?match=，只導一次", async () => {
    mockSearch = "?m=match-9";
    routes["/api/matches/match-9"] = detail("playing");
    const { result, rerender } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("playing"));
    await waitFor(() => expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/game/game-123?match=match-9"));
    rerender();
    expect(mockSetLocation.mock.calls.filter(([to]) => String(to).includes("/game/"))).toHaveLength(1);
  });

  it("WS 先通知開賽（DB 還是 waiting）→ 也視為進行中", async () => {
    mockSearch = "?m=match-9";
    routes["/api/matches/match-9"] = detail("waiting");
    mockWs.matchStatus = "playing";
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("playing"));
  });

  it("旁觀者（不在參賽名單）→ 不導向遊戲頁，留在大廳看排名", async () => {
    mockSearch = "?m=match-9";
    routes["/api/matches/match-9"] = detail("playing", ["someone-else"]);
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("playing"));
    expect(result.current.isParticipant).toBe(false);
    expect(mockSetLocation.mock.calls.some(([to]) => String(to).includes("/game/"))).toBe(false);
  });

  it("再來一場 → 回列表（網址清掉 ?m=）", async () => {
    mockSearch = "?m=match-9";
    routes["/api/matches/match-9"] = detail("finished");
    const { result } = renderHook(() => useMatchLobby(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.currentView).toBe("finished"));
    act(() => result.current.playAnother());
    expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/match/game-123", { replace: true });
  });
});
