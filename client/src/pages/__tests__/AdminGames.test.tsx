import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- Mock useAdminGames ---
const mockCtx = {
  admin: { id: "admin-1", email: "admin@test.com" },
  authLoading: false,
  isAuthenticated: true,
  games: [] as Record<string, unknown>[],
  filteredGames: [] as Record<string, unknown>[],
  gameCounts: { all: 0, draft: 0, published: 0, archived: 0 },
  gamesLoading: false,
  statusFilter: "all",
  setStatusFilter: vi.fn(),
  searchQuery: "",
  setSearchQuery: vi.fn(),
  formData: { title: "", description: "", difficulty: "medium", estimatedTime: "", maxPlayers: "6" },
  setFormData: vi.fn(),
  editingGame: null,
  isDialogOpen: false,
  setIsDialogOpen: vi.fn(),
  isQRDialogOpen: false,
  setIsQRDialogOpen: vi.fn(),
  isCoverDialogOpen: false,
  setIsCoverDialogOpen: vi.fn(),
  deleteGame: null,
  setDeleteGame: vi.fn(),
  selectedGame: null,
  setSelectedGame: vi.fn(),
  coverUploadGame: null,
  setCoverUploadGame: vi.fn(),
  isUploadingCover: false,
  isWizardOpen: false,
  setIsWizardOpen: vi.fn(),
  navigate: vi.fn(),
  handleEdit: vi.fn(),
  handleSubmit: vi.fn(),
  resetForm: vi.fn(),
  uploadCoverImage: vi.fn(),
  createPending: false,
  updatePending: false,
  deletePending: false,
  publishPending: false,
  generateQRPending: false,
  onDelete: vi.fn(),
  onPublish: vi.fn(),
  onGenerateQR: vi.fn(),
};

vi.mock("../admin-games/useAdminGames", () => ({
  useAdminGames: () => mockCtx,
}));

// Mock 子元件避免深度渲染
vi.mock("@/components/AdminLayout", () => ({
  default: ({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) => (
    <div data-testid="admin-layout">
      <h1>{title}</h1>
      <div data-testid="layout-actions">{actions}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/components/admin-games", () => ({
  GameFormDialog: () => <div data-testid="game-form-dialog" />,
  QRCodeDialog: () => <div data-testid="qr-dialog" />,
  CoverUploadDialog: () => <div data-testid="cover-dialog" />,
  DeleteGameDialog: () => <div data-testid="delete-dialog" />,
}));

vi.mock("@/components/game-wizard", () => ({
  GameWizard: () => <div data-testid="game-wizard" />,
}));

vi.mock("../admin-games/GamesTable", () => ({
  GamesTable: ({ games }: { games: unknown[] }) => (
    <div data-testid="games-table">遊戲數: {games.length}</div>
  ),
}));

import AdminGames from "../AdminGames";

describe("AdminGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx.authLoading = false;
    mockCtx.isAuthenticated = true;
    mockCtx.admin = { id: "admin-1", email: "admin@test.com" };
    mockCtx.games = [];
    mockCtx.filteredGames = [];
    mockCtx.gameCounts = { all: 0, draft: 0, published: 0, archived: 0 };
    mockCtx.gamesLoading = false;
    mockCtx.searchQuery = "";
    mockCtx.statusFilter = "all";
  });

  it("authLoading 時顯示 spinner", () => {
    mockCtx.authLoading = true;
    const { container } = render(<AdminGames />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("未認證時回傳 null", () => {
    mockCtx.isAuthenticated = false;
    mockCtx.admin = null as unknown as typeof mockCtx.admin;
    const { container } = render(<AdminGames />);
    expect(container.innerHTML).toBe("");
  });

  it("認證後渲染 AdminLayout", () => {
    render(<AdminGames />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(screen.getByText("遊戲管理")).toBeInTheDocument();
  });

  it("渲染搜尋欄位", () => {
    render(<AdminGames />);
    expect(screen.getByTestId("input-search-games")).toBeInTheDocument();
  });

  it("搜尋輸入觸發 setSearchQuery", () => {
    render(<AdminGames />);
    fireEvent.change(screen.getByTestId("input-search-games"), { target: { value: "冒險" } });
    expect(mockCtx.setSearchQuery).toHaveBeenCalledWith("冒險");
  });

  it("渲染 4 個狀態標籤", () => {
    mockCtx.gameCounts = { all: 10, draft: 3, published: 5, archived: 2 };
    render(<AdminGames />);
    expect(screen.getByTestId("tab-all")).toHaveTextContent("全部 (10)");
    expect(screen.getByTestId("tab-draft")).toHaveTextContent("草稿 (3)");
    expect(screen.getByTestId("tab-published")).toHaveTextContent("已發布 (5)");
    expect(screen.getByTestId("tab-archived")).toHaveTextContent("已封存 (2)");
  });

  it("點擊新增遊戲按鈕觸發 setIsWizardOpen", () => {
    render(<AdminGames />);
    fireEvent.click(screen.getByTestId("button-create-game"));
    expect(mockCtx.setIsWizardOpen).toHaveBeenCalledWith(true);
  });

  it("gamesLoading 顯示載入文字", () => {
    mockCtx.gamesLoading = true;
    render(<AdminGames />);
    expect(screen.getByText("載入中...")).toBeInTheDocument();
  });

  it("空 games 顯示提示文字", () => {
    render(<AdminGames />);
    expect(screen.getByText("尚無遊戲，點擊「新增遊戲」開始建立")).toBeInTheDocument();
  });

  it("有 games 但 filteredGames 為空顯示篩選提示", () => {
    mockCtx.games = [{ id: "g1" }];
    mockCtx.filteredGames = [];
    render(<AdminGames />);
    expect(screen.getByText("沒有符合條件的遊戲")).toBeInTheDocument();
  });

  it("有 filteredGames 時渲染 GamesTable", () => {
    const games = [{ id: "g1" }, { id: "g2" }];
    mockCtx.games = games;
    mockCtx.filteredGames = games;
    render(<AdminGames />);
    expect(screen.getByTestId("games-table")).toBeInTheDocument();
    expect(screen.getByText("遊戲數: 2")).toBeInTheDocument();
  });

  it("渲染所有對話框 mock", () => {
    render(<AdminGames />);
    expect(screen.getByTestId("game-form-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("qr-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("cover-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("game-wizard")).toBeInTheDocument();
  });
});
