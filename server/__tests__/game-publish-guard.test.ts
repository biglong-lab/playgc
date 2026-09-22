// 🚦 發佈把關：編輯器 / 設定頁（PATCH）改成 published 也要跑共用檢查
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: { getGame: vi.fn(), getPages: vi.fn() },
}));
vi.mock("../storage", () => ({ storage: mockStorage }));

import { rejectIfNotPublishable } from "../services/game-publish-guard";

function fakeRes() {
  const res = { statusCode: 0, body: undefined as unknown, status: vi.fn(), json: vi.fn() };
  res.status.mockImplementation((code: number) => { res.statusCode = code; return res; });
  res.json.mockImplementation((b: unknown) => { res.body = b; return res; });
  return res;
}

const textPage = { id: "p1", pageOrder: 1, pageType: "text_card", config: { title: "開場", content: "歡迎" } };

describe("rejectIfNotPublishable", () => {
  beforeEach(() => {
    mockStorage.getGame.mockReset().mockResolvedValue({ id: "g1", title: "金門探險" });
    mockStorage.getPages.mockReset();
  });

  it("不是改成 published → 放行、不查 DB", async () => {
    const res = fakeRes();
    expect(await rejectIfNotPublishable("g1", "draft", res as never)).toBe(false);
    expect(await rejectIfNotPublishable("g1", undefined, res as never)).toBe(false);
    expect(mockStorage.getPages).not.toHaveBeenCalled();
  });

  it("0 頁要發佈 → 400 not_publishable + 問題清單", async () => {
    mockStorage.getPages.mockResolvedValue([]);
    const res = fakeRes();
    expect(await rejectIfNotPublishable("g1", "published", res as never)).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: "not_publishable" });
    expect((res.body as { errors: Array<{ message: string }> }).errors[0].message).toContain("至少需要 1 個頁面");
  });

  it("內容合格 → 放行", async () => {
    mockStorage.getPages.mockResolvedValue([textPage]);
    const res = fakeRes();
    expect(await rejectIfNotPublishable("g1", "published", res as never)).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });
});
