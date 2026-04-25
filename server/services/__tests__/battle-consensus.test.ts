import { describe, expect, it } from "vitest";
import { checkConsensus } from "../battle-consensus";

describe("battle-consensus (Mode B 玩家自評)", () => {
  it("少於 2 份回報 → 不一致", () => {
    expect(checkConsensus([])).toEqual({ consistent: false });
    expect(
      checkConsensus([
        {
          reporterUserId: "u1",
          team: "red",
          result: "win",
          reportedAt: new Date(),
        },
      ]),
    ).toEqual({ consistent: false });
  });

  it("紅勝 + 藍輸 → 紅勝（一致）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "loss", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(true);
    expect(result.winningTeam).toBe("red");
  });

  it("紅輸 + 藍贏 → 藍勝（一致）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "loss", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "win", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(true);
    expect(result.winningTeam).toBe("blue");
  });

  it("雙方都 draw → 平手", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "draw", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "draw", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(true);
    expect(result.isDraw).toBe(true);
  });

  it("雙方都 win → 不一致（爭議）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "win", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(false);
  });

  it("雙方都 loss → 不一致（爭議）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "loss", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "loss", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(false);
  });

  it("一方 draw 一方 win → 不一致", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "draw", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(false);
  });

  it("同一人多次回報 → 採第一份（先進先得）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u1", team: "red", result: "loss", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "loss", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(true);
    expect(result.winningTeam).toBe("red");
  });

  it("兩個 reporter 同隊 → 不一致（資料異常）", () => {
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u2", team: "red", result: "win", reportedAt: new Date() },
    ]);
    expect(result.consistent).toBe(false);
  });

  it("3 隊以上 → 取前 2 隊判斷（簡化）", () => {
    // 實務上水彈只有紅藍隊；3 隊是異常情況，但 logic 應仍能處理
    const result = checkConsensus([
      { reporterUserId: "u1", team: "red", result: "win", reportedAt: new Date() },
      { reporterUserId: "u2", team: "blue", result: "loss", reportedAt: new Date() },
      { reporterUserId: "u3", team: "green", result: "loss", reportedAt: new Date() },
    ]);
    // 取前兩個 team 判斷
    expect(result.consistent).toBe(true);
  });
});
