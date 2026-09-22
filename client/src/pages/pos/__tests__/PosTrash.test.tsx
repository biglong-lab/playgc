// 🗑️ POS 垃圾桶頁 — 已刪除的現金支出要看得到、可還原
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();
const mockToast = vi.fn();

vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("../PosLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import PosTrash from "../PosTrash";

const EXPENSE = {
  id: "exp-1", businessDate: "2026-09-22", category: "採購", amountCents: 35_000, note: "買冰塊",
  spentByName: "小明", deletedAt: "2026-09-22T10:00:00.000Z", deleteReason: "重複記帳",
};

function mockApi(trash: Record<string, unknown>) {
  mockFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url === "/api/admin/pos/restore" && init?.method === "POST") return { ok: true };
    return trash;
  });
}

const restoreCalls = () => mockFetch.mock.calls.filter(([url]) => url === "/api/admin/pos/restore");

describe("PosTrash — 現金支出", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockToast.mockReset();
  });

  it("列出已刪除的支出：金額、分類、備註、日期、刪除原因", async () => {
    mockApi({ products: [], modifierGroups: [], transactions: [], expenses: [EXPENSE] });
    render(<PosTrash />);
    expect(await screen.findByText("現金支出（1）")).toBeInTheDocument();
    expect(screen.getByText("NT$350")).toBeInTheDocument();
    expect(screen.getByText(/採購 · 買冰塊 · 2026-09-22/)).toBeInTheDocument();
    expect(screen.getByText("原因：重複記帳")).toBeInTheDocument();
    expect(screen.queryByText("垃圾桶是空的")).not.toBeInTheDocument();
  });

  it("按還原 → 以 type=expense 呼叫還原 API", async () => {
    mockApi({ products: [], modifierGroups: [], transactions: [], expenses: [EXPENSE] });
    render(<PosTrash />);
    fireEvent.click(await screen.findByTestId("button-restore-expense-exp-1"));
    await waitFor(() => expect(restoreCalls()).toHaveLength(1));
    const [, init] = restoreCalls()[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ type: "expense", id: "exp-1" });
  });

  it("只有支出被刪除時，不顯示「垃圾桶是空的」", async () => {
    mockApi({ products: [], modifierGroups: [], transactions: [], expenses: [EXPENSE] });
    render(<PosTrash />);
    await screen.findByText("現金支出（1）");
    expect(screen.queryByText("垃圾桶是空的")).not.toBeInTheDocument();
  });

  it("舊版 API 沒回 expenses 欄位 → 不壞、顯示空", async () => {
    mockApi({ products: [], modifierGroups: [], transactions: [] });
    render(<PosTrash />);
    expect(await screen.findByText("垃圾桶是空的")).toBeInTheDocument();
  });
});
