import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// --- Mock 宣告 ---
const mockToast = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/games", mockNavigate],
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useRequireAdminAuth: () => ({
    admin: { id: "admin-1", email: "admin@test.com" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
}));

import { useAdminGames } from "../admin-games/useAdminGames";
import type { Game } from "@shared/schema";

// 建立測試 wrapper
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

// 模擬遊戲資料
function createMockGameData(overrides?: Partial<Game>): Game {
  return {
    id: "g-1",
    title: "測試遊戲",
    description: "描述",
    status: "published",
    difficulty: "medium",
    estimatedTime: 30,
    maxPlayers: 6,
    gameMode: "individual",
    gameStructure: "linear",
    coverImageUrl: null,
    publicSlug: "test",
    qrCodeUrl: null,
    fieldId: null,
    settings: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Game;
}

describe("useAdminGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));
  });

  it("初始 state 正確", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.searchQuery).toBe("");
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isQRDialogOpen).toBe(false);
    expect(result.current.editingGame).toBeNull();
    expect(result.current.deleteGame).toBeNull();
  });

  it("回傳認證資訊", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.admin).toBeDefined();
    expect(result.current.authLoading).toBe(false);
  });

  it("setStatusFilter 更新篩選", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    act(() => {
      result.current.setStatusFilter("draft");
    });
    expect(result.current.statusFilter).toBe("draft");
  });

  it("setSearchQuery 更新搜尋", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    act(() => {
      result.current.setSearchQuery("冒險");
    });
    expect(result.current.searchQuery).toBe("冒險");
  });

  it("handleEdit 設定 formData + 開啟對話框", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    const game = createMockGameData({
      title: "編輯遊戲",
      description: "測試描述",
      difficulty: "hard",
      estimatedTime: 60,
      maxPlayers: 10,
    });

    act(() => {
      result.current.handleEdit(game);
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.editingGame).not.toBeNull();
    expect(result.current.formData.title).toBe("編輯遊戲");
    expect(result.current.formData.difficulty).toBe("hard");
    expect(result.current.formData.estimatedTime).toBe("60");
    expect(result.current.formData.maxPlayers).toBe("10");
  });

  it("resetForm 清空表單 + 關閉對話框", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });

    // 先 handleEdit 設定 state
    act(() => {
      result.current.handleEdit(createMockGameData({ title: "A" }));
    });
    expect(result.current.isDialogOpen).toBe(true);

    // resetForm
    act(() => {
      result.current.resetForm();
    });
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.editingGame).toBeNull();
    expect(result.current.formData.title).toBe("");
  });

  it("setIsDialogOpen 切換對話框", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    act(() => {
      result.current.setIsDialogOpen(true);
    });
    expect(result.current.isDialogOpen).toBe(true);
  });

  it("mutation pending 初始為 false", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    expect(result.current.createPending).toBe(false);
    expect(result.current.updatePending).toBe(false);
    expect(result.current.deletePending).toBe(false);
    expect(result.current.publishPending).toBe(false);
    expect(result.current.generateQRPending).toBe(false);
  });

  it("navigate 函式可呼叫", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    act(() => {
      result.current.navigate("/admin/games/123");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/admin/games/123");
  });

  it("handleSubmit 新建時呼叫 fetch POST", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "new-1" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });

    // 設定表單
    act(() => {
      result.current.setFormData({
        title: "新遊戲",
        description: "描述",
        difficulty: "easy",
        estimatedTime: "45",
        maxPlayers: "8",
      });
    });

    // 提交
    await act(async () => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/games",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("isWizardOpen 初始為 false", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    expect(result.current.isWizardOpen).toBe(false);
    act(() => {
      result.current.setIsWizardOpen(true);
    });
    expect(result.current.isWizardOpen).toBe(true);
  });

  it("games 預設為空陣列", () => {
    const { result } = renderHook(() => useAdminGames(), { wrapper: createWrapper() });
    expect(result.current.games).toEqual([]);
  });
});
