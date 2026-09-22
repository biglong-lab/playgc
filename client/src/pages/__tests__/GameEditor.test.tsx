import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { customRender } from "@/test/test-utils";

// --- Mock 宣告 ---
const mockSetLocation = vi.fn();
let mockGameId = "game-123";
let mockLocationPath = "/admin/games/game-123";

vi.mock("wouter", () => ({
  useParams: () => ({ gameId: mockGameId }),
  useLocation: () => [mockLocationPath, mockSetLocation],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockApiRequest = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...original,
    apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  };
});

// Mock 子元件避免渲染複雜元件
vi.mock("../game-editor/PageConfigEditor", () => ({
  default: () => <div data-testid="page-config-editor">PageConfigEditor</div>,
}));

vi.mock("../game-editor/EventsEditor", () => ({
  default: () => <div data-testid="events-editor">EventsEditor</div>,
}));

vi.mock("../game-editor/ChapterManager", () => ({
  default: () => <div data-testid="chapter-manager">ChapterManager</div>,
}));

vi.mock("../game-editor/components/ToolboxSidebar", () => ({
  default: ({ onDragStart, onDragEnd, onAddTemplate }: Record<string, unknown>) => (
    <div data-testid="toolbox-sidebar">ToolboxSidebar</div>
  ),
}));

vi.mock("../game-editor/components/PageListSidebar", () => ({
  default: ({ pages, selectedPage }: Record<string, unknown>) => (
    <div data-testid="page-list-sidebar">
      PageListSidebar ({Array.isArray(pages) ? pages.length : 0} 頁)
    </div>
  ),
}));

vi.mock("../game-editor/lib/page-sync", () => ({
  syncPages: vi.fn().mockResolvedValue([]),
}));

vi.mock("../game-editor/constants", () => ({
  PAGE_TEMPLATES: [],
  getPageTypeInfo: (type: string) => ({
    label: type,
    icon: () => null,
    color: "bg-blue-500",
  }),
}));

vi.mock("../game-editor/getDefaultConfig", () => ({
  getDefaultConfig: () => ({}),
}));

vi.mock("@/components/ItemsEditor", () => ({
  default: () => <div data-testid="items-editor">ItemsEditor</div>,
}));

import GameEditor from "../game-editor/index";
import { syncPages } from "../game-editor/lib/page-sync";
import { QueryClient } from "@tanstack/react-query";

// 已存在的遊戲（非 new）：預先塞進 query cache，模擬編輯器載入完成
const MOCK_GAME = {
  id: "game-123",
  title: "原標題",
  description: "",
  difficulty: "medium",
  estimatedTime: 30,
  maxPlayers: 6,
  status: "draft",
  pages: [],
};

function renderExistingGame() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, queryFn: async () => MOCK_GAME },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(["/api/games", "game-123"], MOCK_GAME);
  return customRender(<GameEditor />, { queryClient });
}

/** 載入既有遊戲後把標題改掉 → 形成未存變更 */
async function renderWithUnsavedTitle() {
  renderExistingGame();
  const titleInput = await screen.findByDisplayValue("原標題");
  await userEvent.type(titleInput, "改");
  expect((titleInput as HTMLInputElement).value).toBe("原標題改");
}

describe("GameEditor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGameId = "game-123";
    mockLocationPath = "/admin/games/game-123";
  });

  it("載入中顯示 spinner", () => {
    customRender(<GameEditor />);
    // 初始 useQuery 無資料，isLoading=true → 顯示 spinner
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("新遊戲模式不顯示 spinner", () => {
    mockGameId = "new";
    const { container } = customRender(<GameEditor />);
    // isNew=true → 不查詢 → 不 loading
    expect(container.querySelector(".animate-spin")).toBeFalsy();
  });

  it("新遊戲顯示空白標題輸入框", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const titleInput = screen.getByTestId("input-game-title");
    expect(titleInput).toBeTruthy();
    expect((titleInput as HTMLInputElement).value).toBe("");
  });

  it("新遊戲顯示儲存和發布按鈕", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    expect(screen.getByTestId("button-save")).toBeTruthy();
    expect(screen.getByTestId("button-publish")).toBeTruthy();
  });

  it("新遊戲的預覽按鈕為 disabled", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const previewBtn = screen.getByTestId("button-preview");
    expect(previewBtn).toBeTruthy();
    expect(previewBtn.hasAttribute("disabled")).toBe(true);
  });

  it("返回按鈕導航回遊戲列表", async () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const backBtn = screen.getByTestId("button-back");
    await userEvent.click(backBtn);
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games");
  });

  it("統一使用 /admin/games basePath", async () => {
    mockGameId = "new";
    mockLocationPath = "/admin/games/new";
    customRender(<GameEditor />);
    const backBtn = screen.getByTestId("button-back");
    await userEvent.click(backBtn);
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games");
  });

  it("新遊戲不顯示資源管理列", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    expect(screen.queryByTestId("link-items")).toBeFalsy();
    expect(screen.queryByTestId("link-achievements")).toBeFalsy();
    expect(screen.queryByTestId("link-locations")).toBeFalsy();
    expect(screen.queryByTestId("link-settings")).toBeFalsy();
  });

  it("顯示 Tabs 頁籤", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    expect(screen.getByTestId("tab-page")).toBeTruthy();
    expect(screen.getByTestId("tab-game")).toBeTruthy();
    expect(screen.getByTestId("tab-items")).toBeTruthy();
    expect(screen.getByTestId("tab-events")).toBeTruthy();
    expect(screen.getByTestId("tab-chapters")).toBeTruthy();
  });

  it("顯示 ToolboxSidebar 和 PageListSidebar", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    expect(screen.getByTestId("toolbox-sidebar")).toBeTruthy();
    expect(screen.getByTestId("page-list-sidebar")).toBeTruthy();
  });

  it("無選取頁面時顯示提示文字", () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    expect(screen.getByText("選擇一個頁面進行編輯")).toBeTruthy();
  });

  it("修改標題輸入框", async () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const titleInput = screen.getByTestId("input-game-title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "新遊戲標題");
    expect((titleInput as HTMLInputElement).value).toBe("新遊戲標題");
  });

  it("切換到遊戲設定 Tab 顯示設定表單", async () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const gameTab = screen.getByTestId("tab-game");
    await userEvent.click(gameTab);
    expect(screen.getByTestId("input-description")).toBeTruthy();
    expect(screen.getByTestId("select-difficulty")).toBeTruthy();
    expect(screen.getByTestId("input-time")).toBeTruthy();
    expect(screen.getByTestId("input-players")).toBeTruthy();
  });

  it("章節 Tab 在新遊戲顯示提示訊息", async () => {
    mockGameId = "new";
    customRender(<GameEditor />);
    const chaptersTab = screen.getByTestId("tab-chapters");
    await userEvent.click(chaptersTab);
    expect(screen.getByText("請先儲存遊戲後再管理章節")).toBeTruthy();
  });
});

describe("GameEditor 未存變更攔截", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGameId = "game-123";
    mockLocationPath = "/admin/games/game-123";
    mockApiRequest.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.mocked(syncPages).mockResolvedValue([]);
  });

  it("沒改任何東西 → 返回直接回列表、不跳對話框", async () => {
    renderExistingGame();
    await screen.findByDisplayValue("原標題");
    await userEvent.click(screen.getByTestId("button-back"));
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games");
    expect(screen.queryByText("有未儲存的變更")).toBeNull();
  });

  it("改了標題 → 返回先跳對話框、不換頁", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("button-back"));
    expect(screen.getByText("有未儲存的變更")).toBeInTheDocument();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("改了標題 → 選「不存離開」→ 回列表、不存檔", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("button-back"));
    await userEvent.click(screen.getByTestId("button-leave-without-saving"));
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games");
    expect(mockApiRequest).not.toHaveBeenCalledWith("PATCH", expect.anything(), expect.anything());
  });

  it("改了標題 → 選「儲存後離開」→ 先 PATCH 再回列表", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("button-back"));
    await userEvent.click(screen.getByTestId("button-save-and-leave"));
    await waitFor(() => expect(mockSetLocation).toHaveBeenCalledWith("/admin/games"));
    expect(mockApiRequest).toHaveBeenCalledWith(
      "PATCH",
      "/api/games/game-123",
      expect.objectContaining({ title: "原標題改" }),
    );
  });

  it("改了標題 → 點資源連結（道具）→ 被攔下跳對話框", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("link-items"));
    expect(await screen.findByText("有未儲存的變更")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-leave-without-saving"));
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games/game-123/items");
  });

  it("改了標題 → 點 AI 產生器 → 先跳對話框", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("button-ai-generator"));
    expect(screen.getByText("有未儲存的變更")).toBeInTheDocument();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  it("按「儲存」成功後 → 不再算未存，返回直接離開", async () => {
    await renderWithUnsavedTitle();
    await userEvent.click(screen.getByTestId("button-save"));
    await waitFor(() =>
      expect(mockApiRequest).toHaveBeenCalledWith("PATCH", "/api/games/game-123", expect.anything()),
    );
    await waitFor(() => expect(screen.getByTestId("button-save")).not.toBeDisabled());
    await userEvent.click(screen.getByTestId("button-back"));
    expect(mockSetLocation).toHaveBeenCalledWith("/admin/games");
    expect(screen.queryByText("有未儲存的變更")).toBeNull();
  });
});
