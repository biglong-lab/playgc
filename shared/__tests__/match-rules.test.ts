// 🏁 賽事共用規則：開賽條件 / 接力分段檢查 / 平均分段
import { describe, it, expect } from "vitest";
import { evenRelaySegments, matchConfigSaveError, matchStartBlocker, validateRelaySegments } from "../lib/match-rules";

describe("matchStartBlocker", () => {
  const base = { matchMode: "competitive", minParticipants: 2, relayLegCount: 0 };

  it("競賽：人數不足 → 說明還差幾人；夠了 → null", () => {
    expect(matchStartBlocker({ ...base, participantCount: 1 })).toBe("至少需要 2 人才能開始（還差 1 人）");
    expect(matchStartBlocker({ ...base, participantCount: 2 })).toBeNull();
  });

  it("接力：沒分段 → 擋；人數必須剛好等於棒數", () => {
    const relay = { ...base, matchMode: "relay" };
    expect(matchStartBlocker({ ...relay, participantCount: 3 })).toContain("還沒設定分段");
    expect(matchStartBlocker({ ...relay, relayLegCount: 3, participantCount: 2 })).toBe("接力需要剛好 3 人（每人一棒），目前 2 人");
    expect(matchStartBlocker({ ...relay, relayLegCount: 3, participantCount: 4 })).toContain("目前 4 人");
    expect(matchStartBlocker({ ...relay, relayLegCount: 3, participantCount: 3 })).toBeNull();
  });
});

describe("validateRelaySegments", () => {
  it("合法且剛好涵蓋全部頁面 → 沒有錯誤也沒有提醒", () => {
    expect(validateRelaySegments([{ fromPage: 1, toPage: 3 }, { fromPage: 4, toPage: 6 }], 6)).toEqual({ errors: [], warnings: [] });
  });

  it("沒有分段 / 超出頁數 / 結束頁小於起始頁 → 錯誤", () => {
    expect(validateRelaySegments([], 5).errors).toEqual(["接力遊戲至少要設定 1 棒"]);
    expect(validateRelaySegments([{ fromPage: 1, toPage: 8 }], 5).errors[0]).toContain("超出範圍（這款遊戲共 5 頁）");
    expect(validateRelaySegments([{ fromPage: 3, toPage: 2 }], 5).errors).toContain("第 1 棒的結束頁不能小於起始頁");
  });

  it("重疊 / 漏頁 → 只提醒不擋", () => {
    const overlap = validateRelaySegments([{ fromPage: 1, toPage: 3 }, { fromPage: 3, toPage: 5 }], 5);
    expect(overlap.errors).toEqual([]);
    expect(overlap.warnings).toContain("有頁面同時分給兩棒（會重複玩）");
    const gap = validateRelaySegments([{ fromPage: 1, toPage: 2 }, { fromPage: 4, toPage: 5 }], 5);
    expect(gap.warnings).toContain("有頁面沒有分給任何一棒（不會有人玩到）");
  });
});

describe("evenRelaySegments", () => {
  it("7 頁分 3 棒 → 3/2/2，連續不重疊", () => {
    expect(evenRelaySegments(7, 3)).toEqual([
      { fromPage: 1, toPage: 3 },
      { fromPage: 4, toPage: 5 },
      { fromPage: 6, toPage: 7 },
    ]);
  });

  it("棒數比頁數多 → 每棒一頁；0 頁 → 空", () => {
    expect(evenRelaySegments(2, 5)).toHaveLength(2);
    expect(evenRelaySegments(0, 3)).toEqual([]);
  });
});

describe("matchConfigSaveError", () => {
  it("接力：沒有頁面 / 分段不合法 → 擋；合法 → null", () => {
    expect(matchConfigSaveError("relay", {}, 0)).toContain("還沒有頁面");
    expect(matchConfigSaveError("relay", { relaySegments: [] }, 4)).toBe("接力遊戲至少要設定 1 棒");
    expect(matchConfigSaveError("relay", { relaySegments: [{ fromPage: 1, toPage: 4 }] }, 4)).toBeNull();
  });

  it("競賽：最少人數大於最多人數 → 擋；一般模式不檢查", () => {
    expect(matchConfigSaveError("competitive", { minParticipants: 5, maxParticipants: 3 }, 4)).toContain("最少人數不能大於最多人數");
    expect(matchConfigSaveError("competitive", {}, 4)).toBeNull();
    expect(matchConfigSaveError("individual", { relaySegments: [] }, 0)).toBeNull();
  });
});
