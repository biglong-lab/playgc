// 頁面同步邏輯 - 單元測試
import { describe, it, expect } from "vitest";
import { updatePageIdReferences } from "./page-sync";
import type { Page } from "@shared/schema";

// 建立測試用 Page
function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "page-1",
    gameId: "game-1",
    pageType: "text_card",
    pageOrder: 1,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("updatePageIdReferences", () => {
  it("無 ID 映射時頁面不變", () => {
    const pages = [makePage({ id: "p1" }), makePage({ id: "p2" })];
    const mapping = new Map<string, string>();

    const result = updatePageIdReferences(pages, mapping);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("p1");
  });

  it("非 button 類型頁面不受影響", () => {
    const pages = [
      makePage({ id: "p1", pageType: "text_card", config: { title: "test" } }),
      makePage({ id: "p2", pageType: "dialogue", config: { character: {} } }),
    ];
    const mapping = new Map([["temp-1", "real-1"]]);

    const result = updatePageIdReferences(pages, mapping);
    expect(result[0].config).toEqual({ title: "test" });
    expect(result[1].config).toEqual({ character: {} });
  });

  it("button 頁面的 nextPageId 被正確替換", () => {
    const pages = [
      makePage({
        id: "p1",
        pageType: "button",
        config: {
          prompt: "選擇",
          buttons: [
            { text: "選項A", nextPageId: "temp-100" },
            { text: "選項B", nextPageId: "temp-200" },
          ],
        },
      }),
    ];
    const mapping = new Map([
      ["temp-100", "real-100"],
      ["temp-200", "real-200"],
    ]);

    const result = updatePageIdReferences(pages, mapping);
    const config = result[0].config as { buttons: Array<{ nextPageId: string }> };
    expect(config.buttons[0].nextPageId).toBe("real-100");
    expect(config.buttons[1].nextPageId).toBe("real-200");
  });

  it("button 頁面中未在映射的 nextPageId 保持不變", () => {
    const pages = [
      makePage({
        id: "p1",
        pageType: "button",
        config: {
          prompt: "選擇",
          buttons: [
            { text: "選項A", nextPageId: "existing-id" },
            { text: "選項B", nextPageId: "temp-100" },
          ],
        },
      }),
    ];
    const mapping = new Map([["temp-100", "real-100"]]);

    const result = updatePageIdReferences(pages, mapping);
    const config = result[0].config as { buttons: Array<{ nextPageId: string }> };
    expect(config.buttons[0].nextPageId).toBe("existing-id");
    expect(config.buttons[1].nextPageId).toBe("real-100");
  });

  it("button 頁面無 nextPageId 欄位時不報錯", () => {
    const pages = [
      makePage({
        id: "p1",
        pageType: "button",
        config: {
          prompt: "選擇",
          buttons: [{ text: "選項A" }, { text: "選項B" }],
        },
      }),
    ];
    const mapping = new Map([["temp-1", "real-1"]]);

    const result = updatePageIdReferences(pages, mapping);
    expect(result).toHaveLength(1);
  });

  it("不會修改原始頁面物件（不可變）", () => {
    const originalConfig = {
      prompt: "選擇",
      buttons: [{ text: "A", nextPageId: "temp-1" }],
    };
    const pages = [
      makePage({ id: "p1", pageType: "button", config: originalConfig }),
    ];
    const mapping = new Map([["temp-1", "real-1"]]);

    updatePageIdReferences(pages, mapping);

    // 原始物件不應被修改
    expect(originalConfig.buttons[0].nextPageId).toBe("temp-1");
  });

  it("混合類型頁面只處理 button 類型", () => {
    const pages = [
      makePage({ id: "p1", pageType: "text_card", config: { title: "hello" } }),
      makePage({
        id: "p2",
        pageType: "button",
        config: {
          prompt: "選擇",
          buttons: [{ text: "A", nextPageId: "temp-1" }],
        },
      }),
      makePage({ id: "p3", pageType: "video", config: { videoUrl: "" } }),
    ];
    const mapping = new Map([["temp-1", "real-1"]]);

    const result = updatePageIdReferences(pages, mapping);
    expect(result[0].config).toEqual({ title: "hello" });
    const btnConfig = result[1].config as { buttons: Array<{ nextPageId: string }> };
    expect(btnConfig.buttons[0].nextPageId).toBe("real-1");
    expect(result[2].config).toEqual({ videoUrl: "" });
  });

  it("空頁面陣列回傳空陣列", () => {
    const result = updatePageIdReferences([], new Map());
    expect(result).toEqual([]);
  });
});
