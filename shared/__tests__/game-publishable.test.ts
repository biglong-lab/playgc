// 發佈前共用檢查 checkGamePublishable 單元測試（前後端共用同一支純函式）
import { describe, it, expect } from "vitest";
import {
  checkGamePublishable,
  isGameStatus,
  GAME_STATUSES,
} from "../lib/game-publishable";
import { isPlayablePageType, PLAYABLE_PAGE_TYPES } from "../lib/page-types";
import type { PageLike } from "../lib/page-config-validation";

function page(id: string, pageType: string, config: Record<string, unknown>, pageOrder = 1): PageLike {
  return { id, pageType, pageOrder, config };
}

const validTextCard = (id = "p1", order = 1) =>
  page(id, "text_card", { title: "開場", content: "歡迎來到賈村" }, order);

const game = { title: "賈村尋寶" };

describe("checkGamePublishable", () => {
  it("0 頁的遊戲不能發佈", () => {
    const result = checkGamePublishable(game, []);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].pageId).toBeUndefined();
    expect(result.errors[0].message).toContain("至少");
  });

  it("有 1 頁合法內容 → 可發佈", () => {
    const result = checkGamePublishable(game, [validTextCard()]);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("不支援的頁面類型 → 擋下並指出是哪一頁", () => {
    const result = checkGamePublishable(game, [
      validTextCard("p1", 1),
      page("p2", "not_a_real_type", {}, 2),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].pageId).toBe("p2");
    expect(result.errors[0].message).toContain("not_a_real_type");
  });

  it("沿用編輯器既有的頁面必要欄位檢查（error 等級會擋）", () => {
    const result = checkGamePublishable(game, [page("p1", "text_card", {})]);
    expect(result.ok).toBe(false);
    // text_card 缺標題 + 缺內容 = 2 個 error
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every((e) => e.pageId === "p1")).toBe(true);
    expect(result.errors[0].message).toContain("第 1 頁");
  });

  it("warning 等級（例如影片缺網址）不擋發佈，行為跟編輯器一致", () => {
    const result = checkGamePublishable(game, [page("p1", "video", {})]);
    expect(result.ok).toBe(true);
  });

  it("跨頁流程 error（要求的道具前面沒發）也會擋", () => {
    const result = checkGamePublishable(game, [
      page("p1", "conditional_verify", {
        conditions: [{ type: "has_item", itemId: "key-1" }],
      }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes("key-1"))).toBe(true);
  });

  it("遊戲名稱空白 → 擋下", () => {
    const result = checkGamePublishable({ title: "   " }, [validTextCard()]);
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toContain("名稱");
  });

  it("pages 傳 null / undefined 視為 0 頁（不丟例外）", () => {
    expect(checkGamePublishable(game, null).ok).toBe(false);
    expect(checkGamePublishable(game, undefined).ok).toBe(false);
  });
});

describe("GAME_STATUSES / isGameStatus", () => {
  it("只接受 draft / published / archived", () => {
    expect([...GAME_STATUSES]).toEqual(["draft", "published", "archived"]);
    expect(isGameStatus("published")).toBe(true);
    expect(isGameStatus("hacked")).toBe(false);
    expect(isGameStatus(undefined)).toBe(false);
    expect(isGameStatus(1)).toBe(false);
  });
});

describe("PLAYABLE_PAGE_TYPES", () => {
  it("常用元件都在清單內、沒有重複", () => {
    for (const t of ["text_card", "dialogue", "gps_mission", "qr_scan", "lock", "host_poll_live"]) {
      expect(isPlayablePageType(t)).toBe(true);
    }
    expect(new Set(PLAYABLE_PAGE_TYPES).size).toBe(PLAYABLE_PAGE_TYPES.length);
  });

  it("未知類型回 false", () => {
    expect(isPlayablePageType("arduino_sensor_legacy")).toBe(false);
    expect(isPlayablePageType("")).toBe(false);
  });
});

describe("checkGamePublishable — 接力分段（2026-09-23）", () => {
  const page = (order: number) => ({ id: `p${order}`, pageOrder: order, pageType: "text_card", config: { title: "t", content: "c" } });
  const pages = [page(1), page(2), page(3), page(4)];

  it("接力遊戲沒設分段 → 擋發佈", () => {
    const r = checkGamePublishable({ title: "接力", gameMode: "relay", matchConfig: null }, pages);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes("至少要設定 1 棒"))).toBe(true);
  });

  it("接力分段超出頁數 → 擋發佈", () => {
    const r = checkGamePublishable(
      { title: "接力", gameMode: "relay", matchConfig: { relaySegments: [{ fromPage: 1, toPage: 2 }, { fromPage: 3, toPage: 9 }] } },
      pages,
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toContain("第 2 棒的頁碼超出範圍");
  });

  it("接力分段合法 → 可發佈；非接力遊戲不看分段", () => {
    const relay = { title: "接力", gameMode: "relay", matchConfig: { relaySegments: [{ fromPage: 1, toPage: 2 }, { fromPage: 3, toPage: 4 }] } };
    expect(checkGamePublishable(relay, pages).ok).toBe(true);
    expect(checkGamePublishable({ title: "競賽", gameMode: "competitive" }, pages).ok).toBe(true);
  });
});
