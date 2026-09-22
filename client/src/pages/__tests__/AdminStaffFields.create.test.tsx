// 🏗️ 場域管理頁「新增場域」— 只有平台管理員看得到（後端對場域管理員回 403）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockFetch = vi.fn();

vi.mock("../admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetch(...args),
}));
vi.mock("@/hooks/useAdminAuth", () => ({ useAdminAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/UnifiedAdminLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import AdminStaffFields from "../AdminStaffFields";

const FIELD = {
  id: "f1", code: "JIACHUN", name: "賈村競技場", address: null, contactPhone: null, contactEmail: null,
  description: null, status: "active", codeLastChangedAt: null, settings: {}, createdAt: "", updatedAt: "",
};

function mockApi(systemRole: string, fields: unknown[]) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === "/api/admin/me") return { systemRole };
    if (url === "/api/admin/fields") return fields;
    return {};
  });
}

describe("AdminStaffFields — 新增場域按鈕", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("場域管理員（field_director）→ 看不到「新增場域」", async () => {
    mockApi("field_director", [FIELD]);
    render(<AdminStaffFields />);
    expect(await screen.findByText("賈村競技場")).toBeInTheDocument();
    expect(screen.queryByTestId("button-add-field")).not.toBeInTheDocument();
  });

  it("super_admin → 看得到「新增場域」", async () => {
    mockApi("super_admin", [FIELD]);
    render(<AdminStaffFields />);
    expect(await screen.findByTestId("button-add-field")).toBeInTheDocument();
  });

  it("場域管理員且沒有場域 → 空狀態不給「新增場域」動作", async () => {
    mockApi("field_director", []);
    render(<AdminStaffFields />);
    expect(await screen.findByText("尚無場域資料")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新增場域" })).not.toBeInTheDocument();
    expect(screen.queryByText(/點擊右上角「新增場域」/)).not.toBeInTheDocument();
  });

  it("super_admin 且沒有場域 → 空狀態提供「新增場域」", async () => {
    mockApi("super_admin", []);
    render(<AdminStaffFields />);
    expect(await screen.findByText("尚無場域資料")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /新增場域/ }).length).toBeGreaterThan(0);
  });
});
