// 匯入示範遊戲 → 成功後要導到「存在的」編輯器路由（/admin/games/:gameId，不是 /edit）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender } from "@/test/test-utils";

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/admin/games", mockNavigate],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockCtx = {
  admin: { id: "admin-1", systemRole: "field_admin" },
  authLoading: false,
  isAuthenticated: true,
  games: [],
  filteredGames: [],
  gameCounts: { all: 0, draft: 0, published: 0, archived: 0, game: 0, activity: 0, scenarioInstances: 0 },
  gamesLoading: false,
  statusFilter: "all",
  setStatusFilter: vi.fn(),
  editorModeFilter: "all",
  setEditorModeFilter: vi.fn(),
  searchQuery: "",
  setSearchQuery: vi.fn(),
  setIsWizardOpen: vi.fn(),
  isWizardOpen: false,
};

vi.mock("../admin-games/useAdminGames", () => ({
  useAdminGames: () => mockCtx,
}));

vi.mock("@/components/UnifiedAdminLayout", () => ({
  default: ({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

// 下拉選單直接攤平成按鈕，避免 Radix pointer 事件在 jsdom 的差異
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: ({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick} data-testid={(rest as { "data-testid"?: string })["data-testid"]}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/admin-games", () => ({
  GameFormDialog: () => null,
  QRCodeDialog: () => null,
  CoverUploadDialog: () => null,
  DeleteGameDialog: () => null,
  MoveFieldDialog: () => null,
}));

vi.mock("@/components/game-wizard", () => ({
  GameWizard: () => null,
}));

vi.mock("../admin-games/GamesTable", () => ({
  GamesTable: () => null,
}));

import AdminGames from "../AdminGames";

describe("AdminGames 匯入示範遊戲", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockNavigate.mockReset();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          game: { id: "demo-game-1", title: "賈村完整示範" },
          pagesCreated: 8,
          playerUrl: "https://game.homi.cc/g/abc",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("匯入成功 → 導到編輯器 /admin/games/:gameId（App.tsx 有註冊的路由）", async () => {
    customRender(<AdminGames />);
    fireEvent.click(screen.getByTestId("menu-import-jiachun"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/admin/games/demo-game-1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/games/create-from-demo",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ templateKey: "jiachun" }) }),
    );
  });
});
