// 🎬 遊戲預覽 — 每次進入都要讀伺服器最新內容（不吃 5 分鐘快取的舊版）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { customRender } from "@/test/test-utils";

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/games/g-1/preview", vi.fn()],
}));

vi.mock("@/components/game/GamePageRenderer", () => ({
  default: () => <div data-testid="page-renderer" />,
}));

import GamePreview from "../GamePreview";

/** 與正式環境相同的快取設定（queryClient.ts：staleTime 5 分鐘） */
function createProdLikeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
}

function mockGameResponse(title: string) {
  return new Response(JSON.stringify({ id: "g-1", title, pages: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GamePreview 讀最新內容", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("編輯器存檔後再開預覽 → 重新向伺服器讀取，顯示新內容", async () => {
    const queryClient = createProdLikeQueryClient();
    fetchSpy.mockResolvedValueOnce(mockGameResponse("第一版標題"));
    const first = customRender(<GamePreview gameId="g-1" />, { queryClient });
    expect(await screen.findByText("第一版標題")).toBeInTheDocument();
    first.unmount();

    // 回編輯器改完存檔 → 伺服器內容已更新
    fetchSpy.mockResolvedValueOnce(mockGameResponse("第二版標題"));
    customRender(<GamePreview gameId="g-1" />, { queryClient });

    expect(await screen.findByText("第二版標題")).toBeInTheDocument();
    expect(screen.queryByText("第一版標題")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
