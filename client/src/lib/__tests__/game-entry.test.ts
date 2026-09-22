import { describe, it, expect } from "vitest";
import { getGameEntryPath, isDirectPlayGame, buildQrEntryTarget } from "../game-entry";

describe("getGameEntryPath", () => {
  it("章節制優先 → 章節列表（即使模式是 team）", () => {
    expect(getGameEntryPath({ id: "g1", gameStructure: "chapters", gameMode: "team" })).toBe("/game/g1/chapters");
  });

  it("競賽 / 接力 → 賽事大廳", () => {
    expect(getGameEntryPath({ id: "g1", gameMode: "competitive" })).toBe("/match/g1");
    expect(getGameEntryPath({ id: "g1", gameMode: "relay" })).toBe("/match/g1");
  });

  it("組隊 → 組隊大廳", () => {
    expect(getGameEntryPath({ id: "g1", gameMode: "team" })).toBe("/team/g1");
  });

  it("單人 / 未設定 → 直接進遊戲", () => {
    expect(getGameEntryPath({ id: "g1", gameMode: "individual" })).toBe("/game/g1");
    expect(getGameEntryPath({ id: "g1" })).toBe("/game/g1");
  });
});

describe("isDirectPlayGame", () => {
  it("只有單人線性遊戲可直接開玩", () => {
    expect(isDirectPlayGame({ id: "g1", gameMode: "individual" })).toBe(true);
    expect(isDirectPlayGame({ id: "g1", gameMode: "team" })).toBe(false);
    expect(isDirectPlayGame({ id: "g1", gameStructure: "chapters" })).toBe(false);
  });
});

describe("buildQrEntryTarget", () => {
  const field = { code: "hpspace" };

  it("單人遊戲 → 遊戲所屬場域的遊戲頁 + entry=qr", () => {
    expect(buildQrEntryTarget({ id: "g1", gameMode: "individual", field })).toBe("/f/HPSPACE/game/g1?entry=qr");
  });

  it("組隊遊戲 → 組隊大廳，保留邀請碼、不加 entry", () => {
    expect(buildQrEntryTarget({ id: "g1", gameMode: "team", field }, "?code=AB12")).toBe("/f/HPSPACE/team/g1?code=AB12");
  });

  it("章節制 → 章節列表", () => {
    expect(buildQrEntryTarget({ id: "g1", gameStructure: "chapters", field })).toBe("/f/HPSPACE/game/g1/chapters");
  });

  it("遊戲沒有場域 → 不加前綴（交給預設場域）", () => {
    expect(buildQrEntryTarget({ id: "g1", field: null })).toBe("/game/g1?entry=qr");
  });
});
