/**
 * useSessionManager — 2026-09-22 開局減法行為
 * - 有進度直接接續（不再等玩家在繼續框做決定）
 * - QR 進場 + 上一場已通關 → 直接開新局
 * - 只有地點鎖遊戲才要 GPS
 * - 建立失敗不再無限自動重試
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";

const { mockApiRequest, mockToast } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/game/g1", vi.fn()] }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/lib/firebase", () => ({ getIdToken: vi.fn().mockResolvedValue("token") }));
vi.mock("@/lib/queryClient", async () => {
  const { QueryClient } = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly body: Record<string, unknown> | null) {
      super(message);
    }
  }
  return {
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ApiError,
  };
});

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useSessionManager } from "../useSessionManager";
import type { Page } from "@shared/schema";

const pages = ["p1", "p2", "p3"].map((id, i) => ({ id, pageOrder: i + 1 })) as unknown as Page[];

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** /api/sessions/active 的回應 */
function mockActiveSession(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: data !== null,
    json: async () => data,
  }) as unknown as typeof fetch;
}

const geo = { getCurrentPosition: vi.fn() };

function setup(overrides: Partial<Parameters<typeof useSessionManager>[0]> = {}) {
  return renderHook(
    () =>
      useSessionManager({
        gameId: "g1",
        userId: "u1",
        isReplayMode: false,
        activePages: pages,
        userName: "玩家",
        requireLocation: false,
        ...overrides,
      }),
    { wrapper },
  );
}

describe("useSessionManager 開局行為", () => {
  beforeEach(() => {
    queryClient.clear();
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue({ json: async () => ({ id: "s-new" }) });
    mockToast.mockReset();
    geo.getCurrentPosition.mockReset();
    geo.getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 24.4, longitude: 118.3 } }),
    );
    Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
  });

  it("沒有舊場次、非地點鎖遊戲 → 直接建新場次，不要求定位", async () => {
    mockActiveSession(null);
    const { result } = setup();
    await waitFor(() => expect(result.current.sessionId).toBe("s-new"));
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    const body = mockApiRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.playerLat).toBeUndefined();
  });

  it("地點鎖遊戲 → 取 GPS 並帶上座標", async () => {
    mockActiveSession(null);
    const { result } = setup({ requireLocation: true });
    await waitFor(() => expect(result.current.sessionId).toBe("s-new"));
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    const body = mockApiRequest.mock.calls[0][2] as Record<string, unknown>;
    expect(body.playerLat).toBe(24.4);
  });

  it("遊戲設定還沒載入（requireLocation undefined）→ 先不建場次", async () => {
    mockActiveSession(null);
    setup({ requireLocation: undefined });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("有進行中進度 → 直接接續到該關，並給出可反悔提示", async () => {
    mockActiveSession({
      session: { id: "s-old", status: "playing", score: 20 },
      progress: { currentPageId: "p2", score: 20 },
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.sessionId).toBe("s-old"));
    expect(result.current.currentPageIndex).toBe(1);
    expect(result.current.resumeNotice).toEqual({ pageNumber: 2, canRestart: true });
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("隊伍共用場次接續 → 提示不提供重新開始", async () => {
    mockActiveSession({
      session: { id: "team-s", status: "playing", score: 0 },
      progress: { currentPageId: "p3" },
    });
    const { result } = setup({ sharedSessionId: "team-s" });
    await waitFor(() => expect(result.current.sessionId).toBe("team-s"));
    expect(result.current.resumeNotice).toEqual({ pageNumber: 3, canRestart: false });
  });

  it("QR 進場且上一場已通關 → 直接開新局（不停在結算畫面）", async () => {
    mockActiveSession({
      session: { id: "s-done", status: "completed", score: 80 },
      progress: { currentPageId: "p3", score: 80 },
    });
    const { result } = setup({ autoRestartCompleted: true });
    await waitFor(() => expect(result.current.sessionId).toBe("s-new"));
    expect(result.current.isCompleted).toBe(false);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it("從大廳進場且上一場已通關 → 顯示結算畫面（行為不變）", async () => {
    mockActiveSession({
      session: { id: "s-done", status: "completed", score: 80 },
      progress: { currentPageId: "p3", score: 80 },
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.isCompleted).toBe(true));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("建立失敗 → 顯示錯誤、不自動重試；按重試才再送一次", async () => {
    mockActiveSession(null);
    mockApiRequest.mockRejectedValueOnce(new Error("400: 此遊戲需在指定地點才能開始，請允許 GPS 定位後重試"));
    const { result } = setup();
    await waitFor(() => expect(result.current.sessionError?.message).toContain("指定地點"));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApiRequest).toHaveBeenCalledTimes(1);

    act(() => result.current.retryCreateSession());
    await waitFor(() => expect(result.current.sessionId).toBe("s-new"));
    expect(mockApiRequest).toHaveBeenCalledTimes(2);
    expect(result.current.sessionError).toBeNull();
  });

  it("🐛 審查 CRITICAL：QR 進場 + 已通關 + 建立失敗 → 只送一次、停在錯誤（不無限重試）", async () => {
    mockActiveSession({
      session: { id: "s-done", status: "completed", score: 80 },
      progress: { currentPageId: "p3", score: 80 },
    });
    mockApiRequest.mockRejectedValue(new Error("403: 必須在「廟口」附近 50m 內才能開始遊戲"));
    const { result } = setup({ autoRestartCompleted: true, requireLocation: true });
    await waitFor(() => expect(result.current.sessionError?.message).toContain("廟口"));
    await new Promise((r) => setTimeout(r, 300));
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result.current.sessionId).toBeNull();
  });

  it("「再玩一次」建立失敗 → 顯示錯誤，不默默退回結算畫面", async () => {
    mockActiveSession({
      session: { id: "s-done", status: "completed", score: 80 },
      progress: { currentPageId: "p3", score: 80 },
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.isCompleted).toBe(true));
    mockApiRequest.mockRejectedValueOnce(new Error("網路錯誤"));
    act(() => result.current.resetAndCreateNew());
    await waitFor(() => expect(result.current.sessionError).toBeTruthy());
    await new Promise((r) => setTimeout(r, 200));
    expect(result.current.isCompleted).toBe(false);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
});
