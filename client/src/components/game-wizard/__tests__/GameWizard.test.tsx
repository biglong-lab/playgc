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

describe("GameWizard 發布遊戲", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let publishResponse: () => Promise<Response>;

  beforeEach(() => {
    mockNavigate.mockReset();
    mockToast.mockReset();
    publishResponse = async () => jsonResponse({ ...CREATED_GAME, status: "published" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/admin/games") return jsonResponse(CREATED_GAME);
      if (url === "/api/admin/games/g-new/publish") return publishResponse();
      throw new Error(`未預期的請求：${url}`);
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function publishCalls() {
    return fetchSpy.mock.calls.filter(([input]) => String(input) === "/api/admin/games/g-new/publish");
  }

  it("按「發布遊戲」→ 真的呼叫發布 API（status=published）", async () => {
    await createGameThroughWizard();
    await userEvent.click(screen.getByTestId("button-publish-game"));

    await vi.waitFor(() => expect(publishCalls()).toHaveLength(1));
    const [, init] = publishCalls()[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "published" });
  });

  it("發布成功 → 提示已發布並關閉精靈回到遊戲列表", async () => {
    const { onOpenChange } = await createGameThroughWizard();
    await userEvent.click(screen.getByTestId("button-publish-game"));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "遊戲已發布" }));
  });

  it("發布失敗（後端把關 400 + 錯誤清單）→ 顯示原因與每一項問題、精靈不關", async () => {
    publishResponse = async () =>
      jsonResponse(
        {
          message: "遊戲尚未符合發布條件",
          errors: ["至少要有 1 個頁面", { message: "第 2 頁缺少題目" }],
        },
        400,
      );
    const { onOpenChange } = await createGameThroughWizard();
    await userEvent.click(screen.getByTestId("button-publish-game"));

    const alert = await screen.findByTestId("publish-error");
    expect(alert).toHaveTextContent("遊戲尚未符合發布條件");
    expect(alert).toHaveTextContent("至少要有 1 個頁面");
    expect(alert).toHaveTextContent("第 2 頁缺少題目");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "發布失敗", variant: "destructive" }),
    );
  });

  it("發布中 → 按鈕顯示進度並停用（防重複送出）", async () => {
    let resolvePublish: (res: Response) => void = () => undefined;
    publishResponse = () => new Promise<Response>((resolve) => { resolvePublish = resolve; });
    await createGameThroughWizard();
    await userEvent.click(screen.getByTestId("button-publish-game"));

    const button = await screen.findByTestId("button-publish-game");
    await vi.waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent("發布中");
    resolvePublish(jsonResponse({ ...CREATED_GAME, status: "published" }));
  });
});
