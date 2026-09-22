// 🐛 後台 QR 管理頁「重新產生短連結」
//   - 之前呼叫不存在的 /regenerate-slug 路由 → 404
//   - 之前讀 data.publicSlug，但 API 回的是 slug → 連結不更新
//   - 重新產生會讓已印出的 QR 失效 → 必須先確認
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { customRender as render } from "@/test/test-utils";
import type { ReactNode } from "react";

const mockApiRequest = vi.fn();
const mockToast = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/UnifiedAdminLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import AdminStaffQRCodes from "../AdminStaffQRCodes";

const GAMES = [
  { id: "g1", title: "已有連結遊戲", status: "published", publicSlug: "oldslug1", qrCodeUrl: null, isIsolated: false, createdAt: "" },
  { id: "g2", title: "尚無連結遊戲", status: "draft", publicSlug: null, qrCodeUrl: null, isIsolated: false, createdAt: "" },
];

/** 模擬既有 QR API：POST /api/admin/games/:id/qrcode（回傳 slug，不是 publicSlug） */
function mockQrApi() {
  mockApiRequest.mockImplementation(async (_method: string, url: string, body?: { regenerateSlug?: boolean }) => {
    const slugByUrl: Record<string, string> = {
      "/api/admin/games/g1/qrcode": body?.regenerateSlug ? "newslug2" : "oldslug1",
      "/api/admin/games/g2/qrcode": "freshslug",
    };
    const slug = slugByUrl[url];
    if (!slug) throw new Error(`404: 路由不存在 ${url}`);
    return { json: async () => ({ slug, qrCodeUrl: `data:image/png;${slug}`, gameUrl: `http://x/g/${slug}` }) };
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, queryFn: async () => GAMES },
      mutations: { retry: false },
    },
  });
  return render(<AdminStaffQRCodes />, { queryClient });
}

async function openViewDialog() {
  fireEvent.click(await screen.findByTestId("button-view-qr-g1"));
  await waitFor(() => {
    expect((screen.getByTestId("input-game-url") as HTMLInputElement).value).toContain("/g/oldslug1");
  });
}

const regenerateCalls = () =>
  mockApiRequest.mock.calls.filter(([, , body]) => (body as { regenerateSlug?: boolean })?.regenerateSlug);

describe("AdminStaffQRCodes — 重新產生短連結", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
    mockQrApi();
  });

  it("首次生成：連結取 API 回傳的 slug 顯示", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("button-generate-qr-g2"));
    await waitFor(() => {
      expect((screen.getByTestId("input-game-url") as HTMLInputElement).value).toContain("/g/freshslug");
    });
  });

  it("按重新生成 → 先跳確認（提醒舊 QR 失效），尚未呼叫 API", async () => {
    renderPage();
    await openViewDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    expect(await screen.findByText(/已印出.*QR.*失效/)).toBeInTheDocument();
    expect(regenerateCalls()).toHaveLength(0);
  });

  it("確認後呼叫既有 QR API（regenerateSlug: true），連結更新成新 slug", async () => {
    renderPage();
    await openViewDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    fireEvent.click(await screen.findByTestId("button-confirm-regenerate"));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith("POST", "/api/admin/games/g1/qrcode", { regenerateSlug: true });
    });
    await waitFor(() => {
      expect((screen.getByTestId("input-game-url") as HTMLInputElement).value).toContain("/g/newslug2");
    });
    expect(mockApiRequest.mock.calls.some(([, url]) => String(url).includes("regenerate-slug"))).toBe(false);
  });

  it("取消確認 → 不重新產生", async () => {
    renderPage();
    await openViewDialog();
    fireEvent.click(screen.getByTestId("button-regenerate-qr"));
    fireEvent.click(await screen.findByTestId("button-cancel-regenerate"));
    await waitFor(() => {
      expect(screen.queryByTestId("button-confirm-regenerate")).not.toBeInTheDocument();
    });
    expect(regenerateCalls()).toHaveLength(0);
  });
});
