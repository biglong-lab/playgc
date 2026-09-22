/**
 * GameBySlug（QR 過場頁）— 掃 QR 後直接導向遊戲，不經大廳
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockSetLocation, mockSearch } = vi.hoisted(() => ({
  mockSetLocation: vi.fn(),
  mockSearch: { value: "" },
}));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: "abc123" }),
  useLocation: () => ["/g/abc123", mockSetLocation],
  useSearch: () => mockSearch.value,
}));

import GameBySlug from "../GameBySlug";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GameBySlug />
    </QueryClientProvider>,
  );
}

function mockFetchGame(status: number, body?: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("GameBySlug QR 過場頁", () => {
  beforeEach(() => {
    mockSetLocation.mockReset();
    mockSearch.value = "";
  });

  it("單人遊戲：直接 replace 導向所屬場域的遊戲頁（帶 entry=qr）", async () => {
    mockFetchGame(200, {
      id: "g1", title: "尋寶", status: "published", gameMode: "individual",
      gameStructure: "linear", field: { code: "HPSPACE" },
    });
    renderPage();
    await waitFor(() =>
      expect(mockSetLocation).toHaveBeenCalledWith("/f/HPSPACE/game/g1?entry=qr", { replace: true }),
    );
  });

  it("組隊遊戲：導向組隊大廳並保留邀請碼", async () => {
    mockSearch.value = "?code=AB12";
    mockFetchGame(200, {
      id: "g2", title: "團戰", status: "published", gameMode: "team",
      gameStructure: "linear", field: { code: "JIACHUN" },
    });
    renderPage();
    await waitFor(() =>
      expect(mockSetLocation).toHaveBeenCalledWith("/f/JIACHUN/team/g2?code=AB12", { replace: true }),
    );
  });

  it("找不到遊戲：顯示錯誤、不導向", async () => {
    mockFetchGame(404);
    renderPage();
    // 頁面對載入失敗會重試 1 次（掃碼時網路不穩），等待時間放寬
    expect(await screen.findByText("無法找到遊戲", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });
});
