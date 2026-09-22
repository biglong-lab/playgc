// 📱 POS 首頁 — 依權限只顯示看得到的按鈕（現場人員不再看到會被導回的死按鈕）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();
const mockAuth = vi.fn();

vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => mockAuth(),
}));

vi.mock("../PosLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import PosDashboard from "../PosDashboard";

const DASHBOARD = {
  date: "2026-09-23",
  fieldId: "f1",
  fieldName: "賈村",
  stats: { totalBookings: 0, arrivedBookings: 0, paidBookings: 0, posTotalPaidCents: 0, posTxCount: 0 },
  upcoming: [],
};

function asRole(systemRole: string, permissions: string[]) {
  mockAuth.mockReturnValue({
    admin: { systemRole, permissions },
    hasPermission: (p: string) => systemRole === "super_admin" || permissions.includes(p),
  });
}

const ADMIN_ONLY = ["品項設定", "銷售報表", "垃圾桶"];
/** 大按鈕以 button role 查（「今日預約」同時是統計卡標籤） */
const btn = (name: string) => screen.queryByRole("button", { name });
const CORE = ["掃描 QR", "收支（收款/支出）", "櫃檯現金", "今日預約", "券核銷", "今日小結"];

describe("PosDashboard — 按鈕依權限顯示", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(DASHBOARD);
  });

  it("現場人員（field_executor）→ 看不到品項 / 報表 / 垃圾桶，但保留現場按鈕與排除障礙", async () => {
    asRole("field_executor", ["game:view", "game:edit", "pos_cash_admin"]);
    render(<PosDashboard />);
    expect(await screen.findByRole("button", { name: "掃描 QR" })).toBeInTheDocument();
    for (const label of CORE) expect(btn(label)).toBeInTheDocument();
    expect(btn("排除障礙")).toBeInTheDocument();
    for (const label of ADMIN_ONLY) expect(btn(label)).not.toBeInTheDocument();
  });

  it("只有 game:view 的自訂角色 → 看不到需要 game:edit / pos_cash_admin 的按鈕", async () => {
    asRole("custom", ["game:view"]);
    render(<PosDashboard />);
    expect(await screen.findByRole("button", { name: "掃描 QR" })).toBeInTheDocument();
    for (const label of ADMIN_ONLY) expect(btn(label)).not.toBeInTheDocument();
  });

  it("有 game:edit 無 pos_cash_admin → 看得到品項 / 垃圾桶、看不到銷售報表", async () => {
    asRole("field_director", ["game:view", "game:edit"]);
    render(<PosDashboard />);
    expect(await screen.findByText("品項設定")).toBeInTheDocument();
    expect(btn("垃圾桶")).toBeInTheDocument();
    expect(btn("銷售報表")).not.toBeInTheDocument();
  });

  it("super_admin → 全部按鈕都在", async () => {
    asRole("super_admin", []);
    render(<PosDashboard />);
    expect(await screen.findByText("品項設定")).toBeInTheDocument();
    for (const label of [...CORE, ...ADMIN_ONLY, "排除障礙"]) {
      expect(btn(label)).toBeInTheDocument();
    }
  });
});
