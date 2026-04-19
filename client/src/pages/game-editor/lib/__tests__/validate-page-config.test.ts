// validate-page-config 單元測試
import { describe, it, expect } from "vitest";
import { validatePageConfig, validateAllPages, validateCrossPageFlow } from "../validate-page-config";
import type { Page } from "@shared/schema";

function makePage(pageType: string, config: Record<string, unknown>, overrides: Partial<Page> = {}): Page {
  return {
    id: "p-1",
    gameId: "g-1",
    pageType,
    pageOrder: 1,
    config,
    createdAt: null,
    chapterId: null,
    ...overrides,
  } as Page;
}

describe("validatePageConfig", () => {
  it("text_card 缺 title 和 content 回報兩個 error", () => {
    const issues = validatePageConfig(makePage("text_card", {}));
    expect(issues).toHaveLength(2);
    expect(issues[0].field).toBe("title");
    expect(issues[1].field).toBe("content");
  });

  it("text_card 完整通過", () => {
    const issues = validatePageConfig(makePage("text_card", { title: "T", content: "C" }));
    expect(issues).toHaveLength(0);
  });

  it("dialogue 空 messages 陣列回報", () => {
    const issues = validatePageConfig(
      makePage("dialogue", { character: { name: "NPC" }, messages: [] }),
    );
    expect(issues.some((i) => i.field === "messages")).toBe(true);
  });

  it("dialogue 缺角色名稱回報", () => {
    const issues = validatePageConfig(
      makePage("dialogue", { character: { name: "" }, messages: [{ text: "hi" }] }),
    );
    expect(issues.some((i) => i.field === "character.name")).toBe(true);
  });

  it("button 空 buttons 回報", () => {
    const issues = validatePageConfig(makePage("button", { buttons: [] }));
    expect(issues.some((i) => i.field === "buttons")).toBe(true);
  });

  it("choice_verify 沒有正確選項回報", () => {
    const issues = validatePageConfig(
      makePage("choice_verify", {
        options: [
          { text: "A", correct: false },
          { text: "B", correct: false },
        ],
      }),
    );
    expect(issues.some((i) => i.field === "options" && i.message.includes("正確選項"))).toBe(true);
  });

  it("conditional_verify fragment 沒綁 sourceItemId 回報", () => {
    const issues = validatePageConfig(
      makePage("conditional_verify", {
        fragments: [{ value: "1" }, { value: "2" }],
      }),
    );
    expect(issues.filter((i) => i.field.includes("sourceItemId"))).toHaveLength(2);
  });

  it("conditional_verify 完全空（無 fragment 無 conditions）回報", () => {
    const issues = validatePageConfig(makePage("conditional_verify", {}));
    expect(issues.some((i) => i.field === "fragments")).toBe(true);
  });

  it("gps_mission qrFallback 開啟但缺 fallbackQrCode 回報", () => {
    const issues = validatePageConfig(
      makePage("gps_mission", {
        targetLocation: { lat: 25, lng: 121 },
        qrFallback: true,
        fallbackQrCode: "",
      }),
    );
    expect(issues.some((i) => i.field === "fallbackQrCode")).toBe(true);
  });

  it("lock combination 長度與 digits 不符回報", () => {
    const issues = validatePageConfig(
      makePage("lock", { combination: "12", digits: 4 }),
    );
    expect(issues.some((i) => i.message.includes("不符"))).toBe(true);
  });

  it("vote 少於 2 個選項回報", () => {
    const issues = validatePageConfig(
      makePage("vote", { question: "Q", options: [{ text: "A" }] }),
    );
    expect(issues.some((i) => i.field === "options")).toBe(true);
  });

  it("qr_scan 缺主要代碼回報", () => {
    const issues = validatePageConfig(makePage("qr_scan", {}));
    expect(issues.some((i) => i.field === "primaryCode")).toBe(true);
  });

  it("shooting_mission 缺 requiredHits 回報", () => {
    const issues = validatePageConfig(makePage("shooting_mission", { timeLimit: 60 }));
    expect(issues.some((i) => i.field === "requiredHits")).toBe(true);
  });
});

describe("validateAllPages", () => {
  it("批次驗證多頁", () => {
    const pages: Page[] = [
      makePage("text_card", { title: "T", content: "C" }, { id: "p1", pageOrder: 1 }),
      makePage("button", { buttons: [] }, { id: "p2", pageOrder: 2 }),
    ];
    const issues = validateAllPages(pages);
    expect(issues).toHaveLength(1);
    expect(issues[0].pageOrder).toBe(2);
  });
});

describe("validateCrossPageFlow — 跨頁流程完整性（jiachun-defense-battle 根因）", () => {
  it("conditional_verify 要的 has_item 若先前沒 page 發 → error", () => {
    const pages: Page[] = [
      makePage("text_card", { title: "T", content: "C" }, { id: "p1", pageOrder: 1 }),
      makePage(
        "conditional_verify",
        { conditions: [{ type: "has_item", itemId: "13" }] },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("13");
  });

  it("先前 page 透過 onCompleteActions 發過道具 → 通過", () => {
    const pages: Page[] = [
      makePage(
        "text_card",
        {
          title: "T",
          content: "C",
          onCompleteActions: [{ type: "add_item", itemId: "13" }],
        },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        { conditions: [{ type: "has_item", itemId: "13" }] },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues).toHaveLength(0);
  });

  it("先前 page 透過 onSuccess.grantItem 發過 → 通過（向後相容 TextVerify 機制）", () => {
    const pages: Page[] = [
      makePage(
        "text_verify",
        { question: "Q", answers: ["A"], onSuccess: { grantItem: 13 } },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        { conditions: [{ type: "has_item", itemId: "13" }] },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues).toHaveLength(0);
  });

  it("number itemId 和 string itemId 都能對上（相容舊 seed）", () => {
    const pages: Page[] = [
      makePage(
        "text_card",
        {
          title: "T",
          content: "C",
          onCompleteActions: [{ type: "add_item", itemId: 13 }], // number
        },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        { conditions: [{ type: "has_item", itemId: "13" }] }, // string
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues).toHaveLength(0);
  });

  it("fragment.sourceItemId 也一樣檢查", () => {
    const pages: Page[] = [
      makePage(
        "conditional_verify",
        {
          fragments: [{ sourceItemId: "99", value: "X" }],
        },
        { id: "p1", pageOrder: 1 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues.some((i) => i.message.includes("99"))).toBe(true);
  });

  it("has_points 要求超過累積上限 → warning", () => {
    const pages: Page[] = [
      makePage(
        "text_card",
        { title: "T", content: "C", rewardPoints: 50 },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        { conditions: [{ type: "has_points", minPoints: 100 }] },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("100"))).toBe(true);
  });

  it("button 頁面每顆按鈕的 items / rewardPoints 都會計入", () => {
    const pages: Page[] = [
      makePage(
        "button",
        {
          buttons: [
            { text: "A", items: ["5", "7"], rewardPoints: 30 },
            { text: "B", items: ["9"] },
          ],
        },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        {
          conditions: [
            { type: "has_item", itemId: "5" },
            { type: "has_item", itemId: "9" },
            { type: "has_points", minPoints: 20 },
          ],
        },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    expect(issues).toHaveLength(0);
  });

  it("重現 jiachun-defense-battle 原始 bug：只發 1 個碎片但要 5 個 → 4 個 error", () => {
    const pages: Page[] = [
      makePage(
        "text_verify",
        { question: "Q", answers: ["A"], onSuccess: { grantItem: 13 } },
        { id: "p1", pageOrder: 1 },
      ),
      makePage(
        "conditional_verify",
        {
          conditions: [
            { type: "has_item", itemId: 13 },
            { type: "has_item", itemId: 14 },
            { type: "has_item", itemId: 15 },
            { type: "has_item", itemId: 16 },
            { type: "has_item", itemId: 17 },
          ],
        },
        { id: "p2", pageOrder: 2 },
      ),
    ];
    const issues = validateCrossPageFlow(pages);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(4);
    expect(errors.every((e) => e.message.includes("未發放"))).toBe(true);
  });
});
