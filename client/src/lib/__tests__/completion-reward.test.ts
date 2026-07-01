// computeCompletionReward 測試 — 重點：ProPlan CHITO #2 防「上一頁重複刷分」
import { describe, it, expect } from "vitest";
import { computeCompletionReward } from "../completion-reward";

const base = {
  score: 100,
  inventory: ["item-a"],
  variables: { flag: true },
};

describe("computeCompletionReward — 防重複刷分（CHITO #2）", () => {
  it("首次完成某頁 → 正常加分", () => {
    const r = computeCompletionReward({
      reward: { points: 30 },
      page: { id: "p2", config: {} },
      completedPageIds: ["p1"], // p2 尚未完成過
      ...base,
    });
    expect(r.alreadyScored).toBe(false);
    expect(r.score).toBe(130);
  });

  it("同 session 回頭重做已完成的頁 → 不再加分", () => {
    const r = computeCompletionReward({
      reward: { points: 30 },
      page: { id: "p2", config: {} },
      completedPageIds: ["p1", "p2"], // p2 已完成過
      ...base,
    });
    expect(r.alreadyScored).toBe(true);
    expect(r.score).toBe(100); // 維持原分、不重複 +30
  });

  it("重複完成 → 也不重複發道具", () => {
    const r = computeCompletionReward({
      reward: { points: 30, items: ["item-b"] },
      page: { id: "p2", config: {} },
      completedPageIds: ["p2"],
      ...base,
    });
    expect(r.inventory).toEqual(["item-a"]); // 不新增 item-b
  });

  it("首次完成 → reward.items 正常發放", () => {
    const r = computeCompletionReward({
      reward: { points: 0, items: ["item-b"] },
      page: { id: "p2", config: {} },
      completedPageIds: [],
      ...base,
    });
    expect(r.inventory).toEqual(["item-a", "item-b"]);
  });

  it("onCompleteActions add_score 首次會加、重複則略過", () => {
    const cfg = { onCompleteActions: [{ type: "add_score", points: 50 }] };
    const first = computeCompletionReward({
      page: { id: "p3", config: cfg },
      completedPageIds: [],
      ...base,
    });
    expect(first.score).toBe(150);

    const repeat = computeCompletionReward({
      page: { id: "p3", config: cfg },
      completedPageIds: ["p3"],
      ...base,
    });
    expect(repeat.score).toBe(100); // 重複完成不再跑 add_score
  });

  it("純函式：不 mutate 輸入", () => {
    const inv = ["item-a"];
    const vars = { flag: true };
    computeCompletionReward({
      reward: { points: 10, items: ["item-b"] },
      page: { id: "p2", config: {} },
      completedPageIds: [],
      score: 0,
      inventory: inv,
      variables: vars,
    });
    expect(inv).toEqual(["item-a"]); // 原陣列未被改
    expect(vars).toEqual({ flag: true });
  });
});
