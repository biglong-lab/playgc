// 💰 櫃檯現金 — 鎖帳動作改名「交班鎖帳」（與報表頁「推送日報」區分，不再兩個都叫「今日結帳」）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();
const mockToast = vi.fn();

vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("../PosLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import PosCash from "../PosCash";

const CLOSING = {
  id: "c2", businessDate: "2026-09-23", countType: "closing", countedCents: 50_000, expectedCents: 50_000,
  varianceCents: 0, varianceReason: null, varianceStatus: "none", adjustmentCents: null,
  countedByName: "小明", countedAt: "", denominations: {},
};

const TODAY_CLOSING_DONE = {
  date: "2026-09-23",
  opening: { ...CLOSING, id: "c1", countType: "opening" },
  closing: CLOSING,
  openingExpected: 50_000,
  closingExpected: 50_000,
  cashSalesCents: 0,
  cashRefundsCents: 0,
  todayDrawdownsCents: 0,
  todayExpensesCents: 0,
  settlement: null,
  locked: false,
  stage: "closing_done",
  canCashAdmin: false,
};

function mockApi() {
  mockFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url === "/api/pos/cash/settle" && init?.method === "POST") return { ok: true };
    if (url.startsWith("/api/pos/cash/today")) return TODAY_CLOSING_DONE;
    if (url.startsWith("/api/pos/cash/history")) return { counts: [], drawdowns: [] };
    return { adjustments: [] };
  });
}

describe("PosCash — 交班鎖帳", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch.mockReset();
    mockToast.mockReset();
    mockApi();
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("鎖帳卡片與按鈕叫「交班鎖帳」，畫面不再出現「今日結帳」", async () => {
    render(<PosCash />);
    expect(await screen.findByTestId("cash-settle")).toHaveTextContent("確認交班鎖帳");
    expect(screen.getByText("🧾 交班鎖帳")).toBeInTheDocument();
    expect(screen.getByTestId("cash-action-tosettle")).toHaveTextContent("前往交班鎖帳");
    expect(screen.queryByText(/今日結帳/)).not.toBeInTheDocument();
  });

  it("確認框與成功提示用「交班鎖帳」字樣", async () => {
    render(<PosCash />);
    fireEvent.click(await screen.findByTestId("cash-settle"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("交班鎖帳"));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("交班鎖帳") }));
    });
  });

  it("確認框按取消 → 不送出", async () => {
    confirmSpy.mockReturnValue(false);
    render(<PosCash />);
    fireEvent.click(await screen.findByTestId("cash-settle"));
    expect(mockFetch).not.toHaveBeenCalledWith("/api/pos/cash/settle", expect.anything());
  });
});
