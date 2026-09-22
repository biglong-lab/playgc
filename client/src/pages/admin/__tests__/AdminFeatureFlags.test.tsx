// 元件遠端開關頁（P0-B 2026-09-23）
//   - 非 super_admin 看不到「全平台」選項、新增預設本場域
//   - 新增 / 切換前都要確認框，寫明影響範圍（AlertDialog，不用原生 confirm）
//   - 非 super_admin 的全域開關列只能看、不能切
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { customRender as render } from "@/test/test-utils";

const { mockApiRequest, authState } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  authState: { admin: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: mockApiRequest };
});

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({ admin: authState.admin, isAuthenticated: true, isLoading: false }),
}));

import AdminFeatureFlags from "../AdminFeatureFlags";

const fieldDirector = { id: "a-1", fieldId: "field-1", fieldName: "賈村競技場", systemRole: "field_director", permissions: [] };
const superAdmin = { ...fieldDirector, id: "a-super", systemRole: "super_admin" };

const baseFlag = {
  disabledReason: null, disabledAt: null, disabledBy: null, metrics: null, updatedAt: "2026-09-23T00:00:00Z",
};
const flags = [
  { ...baseFlag, id: "flag-g", scope: "global", fieldId: null, moduleKey: "trivia_showdown", enabled: true },
  { ...baseFlag, id: "flag-f1", scope: "field", fieldId: "field-1", moduleKey: "lock", enabled: true },
];

function json(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

function setupApi() {
  mockApiRequest.mockImplementation(async (method: string) => {
    if (method === "GET") return json({ flags });
    return json({ flag: flags[1] });
  });
}

const writeCalls = () => mockApiRequest.mock.calls.filter(([m]) => m !== "GET");

describe("AdminFeatureFlags", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    setupApi();
  });

  describe("場域管理員（非 super_admin）", () => {
    beforeEach(() => {
      authState.admin = fieldDirector;
    });

    it("看不到「全平台」選項，範圍固定本場域", async () => {
      render(<AdminFeatureFlags />);
      await screen.findByTestId("flag-lock");

      expect(screen.queryByTestId("btn-scope-global")).not.toBeInTheDocument();
      expect(screen.getByTestId("add-flag-scope")).toHaveTextContent("本場域");
    });

    it("新增前跳確認框寫明只影響本場域，確認後才送出 scope=field", async () => {
      render(<AdminFeatureFlags />);
      fireEvent.change(screen.getByTestId("input-new-module"), { target: { value: "photo_ar" } });
      fireEvent.click(screen.getByTestId("btn-add-flag"));

      const dialog = await screen.findByTestId("dialog-flag-confirm");
      expect(dialog).toHaveTextContent("只影響本場域");
      expect(dialog).toHaveTextContent("賈村競技場");
      expect(writeCalls()).toHaveLength(0);

      fireEvent.click(screen.getByTestId("btn-flag-confirm"));
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]).toEqual([
        "POST",
        "/api/admin/feature-flags",
        expect.objectContaining({ scope: "field", moduleKey: "photo_ar", enabled: false }),
      ]);
    });

    it("全域開關列唯讀（沒有切換鈕），本場域覆寫可切換", async () => {
      render(<AdminFeatureFlags />);
      await screen.findByTestId("flag-lock");

      expect(screen.queryByTestId("btn-toggle-trivia_showdown")).not.toBeInTheDocument();
      expect(screen.getByTestId("flag-trivia_showdown")).toHaveTextContent("僅平台可改");
      expect(screen.getByTestId("btn-toggle-lock")).toBeInTheDocument();
    });

    it("切換本場域覆寫前要確認，取消就不送出", async () => {
      render(<AdminFeatureFlags />);
      fireEvent.click(await screen.findByTestId("btn-toggle-lock"));

      const dialog = await screen.findByTestId("dialog-flag-confirm");
      expect(dialog).toHaveTextContent("停用");
      expect(dialog).toHaveTextContent("只影響本場域");

      fireEvent.click(screen.getByTestId("btn-flag-cancel"));
      await waitFor(() => expect(screen.queryByTestId("dialog-flag-confirm")).not.toBeInTheDocument());
      expect(writeCalls()).toHaveLength(0);
    });

    it("確認切換 → PATCH", async () => {
      render(<AdminFeatureFlags />);
      fireEvent.click(await screen.findByTestId("btn-toggle-lock"));
      fireEvent.click(await screen.findByTestId("btn-flag-confirm"));

      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0]).toEqual(["PATCH", "/api/admin/feature-flags/flag-f1", { enabled: false }]);
    });
  });

  describe("super_admin", () => {
    beforeEach(() => {
      authState.admin = superAdmin;
    });

    it("可選全平台；選全平台新增時確認框警告影響所有場域", async () => {
      render(<AdminFeatureFlags />);
      fireEvent.click(screen.getByTestId("btn-scope-global"));
      fireEvent.change(screen.getByTestId("input-new-module"), { target: { value: "photo_ar" } });
      fireEvent.click(screen.getByTestId("btn-add-flag"));

      const dialog = await screen.findByTestId("dialog-flag-confirm");
      expect(dialog).toHaveTextContent("所有場域");

      fireEvent.click(screen.getByTestId("btn-flag-confirm"));
      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      expect(writeCalls()[0][2]).toEqual(expect.objectContaining({ scope: "global" }));
    });

    it("全域開關列可切換", async () => {
      render(<AdminFeatureFlags />);
      expect(await screen.findByTestId("btn-toggle-trivia_showdown")).toBeInTheDocument();
    });
  });
});
