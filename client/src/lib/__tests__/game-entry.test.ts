import { describe, it, expect } from "vitest";
import { getGameEntryPath, isDirectPlayGame } from "../game-entry";

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
