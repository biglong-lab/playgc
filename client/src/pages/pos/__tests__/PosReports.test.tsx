// 📊 POS 報表頁 — 區間統計：上個月 / 自訂起訖 / 區間標題
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();
const mockToast = vi.fn();

vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({ hasPermission: () => true, admin: { systemRole: "field_admin" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("../PosLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import PosReports from "../PosReports";

const RANGE_PREFIX = "/api/admin/pos/reports/range";

const EMPTY_DAILY = {
  date: "", totalCents: 0, refundsCents: 0, netCents: 0, refundCount: 0, txnCount: 0, itemCount: 0,
  byMethod: [], byCategory: [], byProduct: [], byModifier: [], byHour: [],
};
const EMPTY_STATUS = {
  bookings: { today: 0, month: 0, future: 0, srcLineDirect: 0, srcManual: 0, srcManualLinked: 0 },
  refundsThisMonth: { count: 0, cents: 0 },
};

/** 依 URL 回假資料；區間報表回傳 query 帶進來的起訖 + 固定金額 */
function mockApi() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.startsWith(RANGE_PREFIX)) {
      const q = new URLSearchParams(url.split("?")[1]);
      return {
        fromDate: q.get("from"), toDate: q.get("to"),
        totalCents: 1_234_500, refundsCents: 0, netCents: 1_234_500, txnCount: 7, daily: [],
      };
    }
    if (url.startsWith("/api/admin/pos/reports/daily")) return EMPTY_DAILY;
    if (url.startsWith("/api/admin/pos/reports/status")) return EMPTY_STATUS;
    return { openingCents: null, closingCents: null, drawdownCents: 0 };
  });
}

const rangeCalls = () =>
  mockFetch.mock.calls.map(([url]) => url as string).filter((u) => u.startsWith(RANGE_PREFIX));

function setCustom(from: string, to: string) {
  fireEvent.change(screen.getByTestId("range-custom-from"), { target: { value: from } });
  fireEvent.change(screen.getByTestId("range-custom-to"), { target: { value: to } });
  fireEvent.click(screen.getByTestId("range-custom-submit"));
}

describe("PosReports — 區間統計", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockApi();
    // 只假造 Date：台北 2026-01-15（週四），驗證「上個月」跨年
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T04:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("點「上個月」→ 以去年 12 月整月呼叫 API 並顯示標題", async () => {
    render(<PosReports />);
    fireEvent.click(screen.getByTestId("range-last-month"));

    await waitFor(() => {
      expect(rangeCalls()).toContain(`${RANGE_PREFIX}?from=2025-12-01&to=2025-12-31`);
    });
    expect(await screen.findByText("上個月（2025-12-01 ~ 2025-12-31）")).toBeInTheDocument();
    expect(await screen.findByText("NT$12,345")).toBeInTheDocument();
  });

  it("點「本週」→ 以台北時區週一起算", async () => {
    render(<PosReports />);
    fireEvent.click(screen.getByTestId("range-week"));
    await waitFor(() => {
      expect(rangeCalls()).toContain(`${RANGE_PREFIX}?from=2026-01-12&to=2026-01-15`);
    });
    expect(screen.getByText("本週（2026-01-12 ~ 2026-01-15）")).toBeInTheDocument();
  });

  it("自訂起訖合法 → 以輸入的起訖呼叫 API、標題顯示「自訂」", async () => {
    render(<PosReports />);
    setCustom("2025-11-03", "2025-12-20");
    await waitFor(() => {
      expect(rangeCalls()).toContain(`${RANGE_PREFIX}?from=2025-11-03&to=2025-12-20`);
    });
    expect(screen.getByText("自訂（2025-11-03 ~ 2025-12-20）")).toBeInTheDocument();
  });

  it("自訂起 > 訖 → 顯示錯誤、不呼叫區間 API", async () => {
    render(<PosReports />);
    setCustom("2025-12-20", "2025-12-01");
    expect(await screen.findByTestId("range-custom-error")).toHaveTextContent("起始日不可晚於結束日");
    expect(rangeCalls()).toHaveLength(0);
  });

  it("自訂只填一邊 → 提示選擇起訖、不呼叫", async () => {
    render(<PosReports />);
    setCustom("2025-12-01", "");
    expect(await screen.findByTestId("range-custom-error")).toHaveTextContent("請選擇起訖日期");
    expect(rangeCalls()).toHaveLength(0);
  });

  it("修正後再查詢 → 錯誤訊息消失並送出", async () => {
    render(<PosReports />);
    setCustom("2025-12-20", "2025-12-01");
    await screen.findByTestId("range-custom-error");
    setCustom("2025-12-01", "2025-12-20");
    await waitFor(() => expect(rangeCalls()).toHaveLength(1));
    expect(screen.queryByTestId("range-custom-error")).not.toBeInTheDocument();
  });

  it("後端回錯 → 顯示錯誤訊息", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.startsWith(RANGE_PREFIX)) throw new Error("查詢區間最長 366 天（目前 400 天）");
      if (url.startsWith("/api/admin/pos/reports/status")) return EMPTY_STATUS;
      return EMPTY_DAILY;
    });
    render(<PosReports />);
    fireEvent.click(screen.getByTestId("range-last-month"));
    expect(await screen.findByText(/查詢區間最長 366 天/)).toBeInTheDocument();
  });
});

describe("PosReports — 推送日報（與櫃檯現金「交班鎖帳」區分）", () => {
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

  it("按鈕叫「推送日報」，畫面不再出現「今日結帳」", () => {
    render(<PosReports />);
    expect(screen.getByTestId("btn-shift-close")).toHaveTextContent("推送日報");
    expect(screen.queryByText(/今日結帳/)).not.toBeInTheDocument();
  });

  it("確認框與成功提示用「推送日報」字樣、不說成結帳", async () => {
    render(<PosReports />);
    fireEvent.click(screen.getByTestId("btn-shift-close"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("推送日報"));
    expect(confirmSpy).not.toHaveBeenCalledWith(expect.stringContaining("結帳"));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/pos/shift/close", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("日報") }));
    });
    const titles = mockToast.mock.calls.map(([arg]) => String(arg?.title ?? ""));
    expect(titles.some((t) => t.includes("結帳"))).toBe(false);
  });
});
