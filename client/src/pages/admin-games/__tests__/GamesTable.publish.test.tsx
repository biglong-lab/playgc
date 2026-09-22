// 遊戲列表「發布」鈕：發佈前跑共用檢查（P0-B）
//   - 不合格 → 顯示錯誤清單對話框（不用原生 alert）、不打發佈 API
//   - 合格 → 呼叫 onPublish
//   - 取消發布（draft）→ 不檢查、直接呼叫
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { Game } from "@shared/schema";

const { mockApiRequest } = vi.hoisted(() => ({ mockApiRequest: vi.fn() }));
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: mockApiRequest };
});

import { GamesTable } from "../GamesTable";

function jsonResponse(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

const draftGame = {
  id: "g1", title: "賈村尋寶", status: "draft", publicSlug: "ABC", isIsolated: true,
} as unknown as Game;

const publishedGame = { ...draftGame, id: "g2", status: "published" } as unknown as Game;

function renderTable(games: Game[], overrides: Record<string, unknown> = {}) {
  const props = {
    games,
    onNavigate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onPublish: vi.fn(),
    onToggleHomeVisible: vi.fn(),
    onGenerateQR: vi.fn(),
    onViewQR: vi.fn(),
    onCoverUpload: vi.fn(),
    publishPending: false,
    homeVisiblePending: false,
    generateQRPending: false,
    ...overrides,
  };
  render(<GamesTable {...props} />);
  return props;
}

describe("GamesTable 發布前檢查", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it("0 頁遊戲：顯示錯誤清單、不呼叫 onPublish", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonResponse({ id: "g1", title: "賈村尋寶", pages: [] }));
    const props = renderTable([draftGame]);

    fireEvent.click(screen.getAllByTestId("button-publish-g1")[0]);

    const dialog = await screen.findByTestId("dialog-publish-blocked");
    expect(dialog).toHaveTextContent("至少需要 1 個頁面");
    expect(props.onPublish).not.toHaveBeenCalled();
    expect(mockApiRequest).toHaveBeenCalledWith("GET", "/api/admin/games/g1");
  });

  it("頁面缺必要欄位：列出第幾頁的問題", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonResponse({
      id: "g1", title: "賈村尋寶",
      pages: [{ id: "p1", pageOrder: 1, pageType: "text_card", config: {} }],
    }));
    const props = renderTable([draftGame]);

    fireEvent.click(screen.getAllByTestId("button-publish-g1")[0]);

    const dialog = await screen.findByTestId("dialog-publish-blocked");
    expect(dialog).toHaveTextContent("第 1 頁");
    expect(dialog).toHaveTextContent("缺少標題");
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("「前往編輯器」導向該遊戲編輯頁", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonResponse({ id: "g1", title: "賈村尋寶", pages: [] }));
    const props = renderTable([draftGame]);

    fireEvent.click(screen.getAllByTestId("button-publish-g1")[0]);
    fireEvent.click(await screen.findByTestId("button-publish-blocked-edit"));

    expect(props.onNavigate).toHaveBeenCalledWith("/admin/games/g1");
  });

  it("內容合格：呼叫 onPublish(id, published)", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonResponse({
      id: "g1", title: "賈村尋寶",
      pages: [{ id: "p1", pageOrder: 1, pageType: "text_card", config: { title: "T", content: "C" } }],
    }));
    const props = renderTable([draftGame]);

    fireEvent.click(screen.getAllByTestId("button-publish-g1")[0]);

    await waitFor(() => expect(props.onPublish).toHaveBeenCalledWith("g1", "published"));
    expect(screen.queryByTestId("dialog-publish-blocked")).not.toBeInTheDocument();
  });

  it("讀不到內容（網路錯誤）→ 交給後端把關，照樣送出", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("network"));
    const props = renderTable([draftGame]);

    fireEvent.click(screen.getAllByTestId("button-publish-g1")[0]);

    await waitFor(() => expect(props.onPublish).toHaveBeenCalledWith("g1", "published"));
  });

  it("取消發布不跑檢查、直接呼叫", () => {
    const props = renderTable([publishedGame]);

    fireEvent.click(screen.getAllByTestId("button-unpublish-g2")[0]);

    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(props.onPublish).toHaveBeenCalledWith("g2", "draft");
  });
});
