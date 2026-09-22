// 遊戲建立精靈 — 完成步驟的「立即測試」「發布遊戲」要真的做事、開對路由
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { customRender } from "@/test/test-utils";

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/admin/games", mockNavigate],
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import GameWizard from "../GameWizard";

const CREATED_GAME = {
  id: "g-new",
  title: "我的遊戲",
  publicSlug: "slug123",
  status: "draft",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 走完精靈：選模板 → 填名稱 → 建立 → 停在完成步驟 */
async function createGameThroughWizard() {
  const onOpenChange = vi.fn();
  customRender(<GameWizard open onOpenChange={onOpenChange} editorMode="activity" />);
  await userEvent.click(screen.getAllByTestId(/^template-card-/)[0]);
  await userEvent.type(screen.getByTestId("input-game-name"), "我的遊戲");
  await userEvent.click(screen.getByTestId("button-create-game"));
  await screen.findByText("遊戲建立成功！");
  return { onOpenChange };
}

describe("GameWizard 完成步驟", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockNavigate.mockReset();
    mockToast.mockReset();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/admin/games") return jsonResponse(CREATED_GAME);
      throw new Error(`未預期的請求：${String(input)}`);
    });
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    openSpy.mockRestore();
  });

  it("「立即測試」→ 開管理員預覽（草稿也能玩、不寫資料），不是大螢幕 /play/ 路由", async () => {
    await createGameThroughWizard();
    await userEvent.click(screen.getByTestId("button-test-game"));

    expect(openSpy).toHaveBeenCalledWith("/admin/games/g-new/preview", "_blank");
    const openedUrls = openSpy.mock.calls.map((call) => String(call[0]));
    expect(openedUrls.some((url) => url.startsWith("/play/"))).toBe(false);
  });
});
