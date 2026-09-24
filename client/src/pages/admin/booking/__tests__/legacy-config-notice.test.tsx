// 📅 2026-09-24：後台「場域預約時間表」已不影響活動，畫面必須講清楚
//   否則管理員在這裡改時段，玩家端完全沒反應（活動只看自己的排程）。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/pages/admin-staff/types", () => ({ fetchWithAdminAuth: mockFetch }));

import { useActiveActivities, LegacyConfigBanner } from "../legacy-config-notice";

/** 把 hook 結果攤平出來看 */
function Probe() {
  const { activities, hasActivities } = useActiveActivities();
  return (
    <>
      <span data-testid="count">{activities.length}</span>
      <span data-testid="has">{String(hasActivities)}</span>
      <LegacyConfigBanner activities={activities} />
    </>
  );
}

function renderProbe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("舊版單一時間表提示", () => {
  it("場域有啟用中的活動 → 顯示「這頁是舊版」橫幅並指向活動管理", async () => {
    mockFetch.mockResolvedValue({
      activities: [
        { id: "a1", name: "夜間場", isActive: true },
        { id: "a2", name: "水槍對戰", isActive: true },
        { id: "a3", name: "已下架的舊活動", isActive: false },
      ],
    });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("has")).toHaveTextContent("true"));
    // 只算啟用中的
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    const banner = screen.getByTestId("banner-legacy-config");
    expect(banner).toHaveTextContent("舊版單一時間表");
    expect(banner).toHaveTextContent("夜間場");
    expect(banner).toHaveTextContent("活動管理");
    expect(banner).not.toHaveTextContent("已下架的舊活動");
  });

  it("場域還沒有活動（單一時間表場域）→ 不顯示橫幅，設定照常用", async () => {
    mockFetch.mockResolvedValue({ activities: [] });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("has")).toHaveTextContent("false"));
    expect(screen.queryByTestId("banner-legacy-config")).toBeNull();
  });

  it("活動列表讀不到（權限不足 / 出錯）→ 當作沒有活動，不亂嚇人", async () => {
    mockFetch.mockRejectedValue(new Error("forbidden"));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("has")).toHaveTextContent("false"));
    expect(screen.queryByTestId("banner-legacy-config")).toBeNull();
  });
});
