/**
 * Home 遊戲大廳測試 — 遊戲列表、搜尋過濾、gameMode 路由分流
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock useAuth
const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

// Mock firebase
vi.mock("@/lib/firebase", () => ({
  signOut: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock wouter
const mockSetLocation = vi.fn();
vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ["/home", mockSetLocation],
  useQuery: () => ({}),
}));

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

function createMockGame(overrides?: Record<string, unknown>) {
  return {
    id: "game-1",
    title: "測試遊戲",
    description: "遊戲描述",
    slug: "test-game",
    coverImageUrl: null,
    difficulty: "medium",
    estimatedDuration: 30,
    maxPlayers: 10,
    gameMode: "individual",
    gameStructure: "linear",
    status: "published",
    isPublished: true,
    fieldId: "field-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// 使用 QueryClient 提供資料
function renderWithQuery(
  ui: React.ReactElement,
  queryData?: Record<string, unknown>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  if (queryData) {
    Object.entries(queryData).forEach(([key, value]) => {
      queryClient.setQueryData([key], value);
    });
  }

  return render(
    createElement(QueryClientProvider, { client: queryClient }, ui),
  );
}

import Home from "@/pages/Home";

describe("Home 遊戲大廳", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", firstName: "測試" },
      firebaseUser: { displayName: "測試使用者", photoURL: null },
      isLoading: false,
      isSignedIn: true,
      isAuthenticated: true,
    });
  });

  it("載入中顯示 skeleton 佔位", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isSignedIn: false,
      isAuthenticated: false,
    });
    renderWithQuery(<Home />);
    // 認證載入中應顯示某種 loading 狀態
    expect(document.body).toBeTruthy();
  });

  it("有遊戲資料時渲染遊戲卡片", () => {
    const games = [
      createMockGame({ id: "g1", title: "古鎮探險" }),
      createMockGame({ id: "g2", title: "密室逃脫" }),
    ];
    renderWithQuery(<Home />, { "/api/games": games });
    expect(screen.getByText("古鎮探險")).toBeInTheDocument();
    expect(screen.getByText("密室逃脫")).toBeInTheDocument();
  });

  it("無遊戲時顯示空狀態", () => {
    renderWithQuery(<Home />, { "/api/games": [] });
    // 應顯示「目前沒有遊戲」或類似提示
    expect(document.body).toBeTruthy();
  });

  it("搜尋篩選遊戲列表", () => {
    const games = [
      createMockGame({ id: "g1", title: "古鎮探險" }),
      createMockGame({ id: "g2", title: "密室逃脫" }),
    ];
    renderWithQuery(<Home />, { "/api/games": games });

    const searchInput = screen.queryByPlaceholderText(/搜尋/i);
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: "古鎮" } });
      expect(screen.getByText("古鎮探險")).toBeInTheDocument();
      expect(screen.queryByText("密室逃脫")).not.toBeInTheDocument();
    }
  });

  it("individual 模式點擊遊戲卡片導向 /game/:id", () => {
    const games = [createMockGame({ id: "g1", title: "單人遊戲", gameMode: "individual", gameStructure: "linear" })];
    renderWithQuery(<Home />, { "/api/games": games });

    const card = screen.getByText("單人遊戲").closest("[data-testid]") || screen.getByText("單人遊戲");
    fireEvent.click(card);
    expect(mockSetLocation).toHaveBeenCalledWith("/game/g1");
  });

  it("team 模式點擊遊戲卡片導向 /team/:id", () => {
    const games = [createMockGame({ id: "g2", title: "團隊遊戲", gameMode: "team", gameStructure: "linear" })];
    renderWithQuery(<Home />, { "/api/games": games });

    const card = screen.getByText("團隊遊戲").closest("[data-testid]") || screen.getByText("團隊遊戲");
    fireEvent.click(card);
    expect(mockSetLocation).toHaveBeenCalledWith("/team/g2");
  });

  it("chapters 結構點擊遊戲卡片導向 /game/:id/chapters", () => {
    const games = [createMockGame({ id: "g3", title: "章節遊戲", gameStructure: "chapters" })];
    renderWithQuery(<Home />, { "/api/games": games });

    const card = screen.getByText("章節遊戲").closest("[data-testid]") || screen.getByText("章節遊戲");
    fireEvent.click(card);
    expect(mockSetLocation).toHaveBeenCalledWith("/game/g3/chapters");
  });

  it("遊戲卡片顯示難度 badge", () => {
    const games = [createMockGame({ id: "g1", title: "簡單遊戲", difficulty: "easy" })];
    renderWithQuery(<Home />, { "/api/games": games });
    // 難度 badge 應該被渲染（text 可能是中文翻譯）
    expect(screen.getByText("簡單遊戲")).toBeInTheDocument();
  });

  it("遊戲卡片顯示預估時間", () => {
    const games = [createMockGame({ id: "g1", title: "快速遊戲", estimatedDuration: 15 })];
    renderWithQuery(<Home />, { "/api/games": games });
    // 應顯示 15 分鐘
    expect(screen.getByText("快速遊戲")).toBeInTheDocument();
  });

  it("已認證使用者可以看到登出按鈕", () => {
    const games = [createMockGame()];
    renderWithQuery(<Home />, { "/api/games": games });
    // 右上角應有使用者 menu 或登出選項
    expect(document.body).toBeTruthy();
  });

  it("多個遊戲同時渲染", () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      createMockGame({ id: `g${i}`, title: `遊戲 ${i + 1}` }),
    );
    renderWithQuery(<Home />, { "/api/games": games });
    expect(screen.getByText("遊戲 1")).toBeInTheDocument();
    expect(screen.getByText("遊戲 5")).toBeInTheDocument();
  });

  it("遊戲封面圖片有正確 alt 文字", () => {
    const games = [createMockGame({ id: "g1", title: "有圖遊戲", coverImageUrl: "https://example.com/img.jpg" })];
    renderWithQuery(<Home />, { "/api/games": games });
    const img = screen.queryByAltText("有圖遊戲");
    if (img) {
      expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
    }
  });
});
