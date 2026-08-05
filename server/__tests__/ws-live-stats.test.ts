// 📊 WS 即時狀態計算 — 純函式測試（不需 DB）
//
// 重點在「風險判定」：活動當天靠這個數字決定要不要介入，
// 判錯的代價是活動當場廣播延遲數秒卻沒人發現。

import { describe, it, expect } from "vitest";
import {
  computeWsLiveStats,
  describeRisk,
  TEAM_SIZE_WARNING,
  TEAM_SIZE_CRITICAL,
} from "../lib/ws-live-stats";

/** 造一個有 n 個成員的房間 */
const room = (n: number): Set<unknown> => new Set(Array.from({ length: n }, (_, i) => ({ i })));

function stats(teams: Record<string, number>, sessions: Record<string, number> = {}) {
  const teamClients = new Map(Object.entries(teams).map(([k, v]) => [k, room(v)]));
  const sessionClients = new Map(Object.entries(sessions).map(([k, v]) => [k, room(v)]));
  const total = Object.values(teams).reduce((a, b) => a + b, 0);
  return computeWsLiveStats({
    totalConnections: total,
    teamClients,
    sessionClients,
    now: new Date("2026-08-05T00:00:00Z"),
  });
}

describe("WS 即時狀態", () => {
  it("沒有任何連線時不會炸，且風險為 ok", () => {
    const s = stats({});
    expect(s.totalConnections).toBe(0);
    expect(s.teamRooms).toBe(0);
    expect(s.largestTeamSize).toBe(0);
    expect(s.largestTeamId).toBeNull();
    expect(s.risk).toBe("ok");
  });

  it("找得出最大的隊伍（扇出風險來源）", () => {
    const s = stats({ a: 3, b: 17, c: 8 });
    expect(s.largestTeamSize).toBe(17);
    expect(s.largestTeamId).toBe("b");
    expect(s.teamRooms).toBe(3);
    expect(s.totalConnections).toBe(28);
  });

  describe("風險判定 —— 看的是最大單隊，不是總人數", () => {
    it("500 人分散成 100 隊 → ok（實測廣播 p95 僅 7ms）", () => {
      const many: Record<string, number> = {};
      for (let i = 0; i < 100; i++) many[`t${i}`] = 5;
      const s = stats(many);
      expect(s.totalConnections).toBe(500);
      expect(s.largestTeamSize).toBe(5);
      expect(s.risk).toBe("ok"); // 總人數 500 但不危險
    });

    it("同一隊達 warning 門檻 → warning", () => {
      const s = stats({ big: TEAM_SIZE_WARNING });
      expect(s.risk).toBe("warning");
      expect(describeRisk(s)).toContain("接近");
    });

    it("同一隊達 critical 門檻 → critical", () => {
      const s = stats({ big: TEAM_SIZE_CRITICAL });
      expect(s.risk).toBe("critical");
      expect(describeRisk(s)).toContain("超過");
    });

    it("剛好低於 warning 一人 → 仍是 ok（邊界）", () => {
      const s = stats({ big: TEAM_SIZE_WARNING - 1 });
      expect(s.risk).toBe("ok");
    });
  });

  describe("熱門隊伍清單", () => {
    it("只列出達 warning 門檻的隊伍，並由大到小排序", () => {
      const s = stats({
        small: 5,
        mid: TEAM_SIZE_WARNING,
        huge: TEAM_SIZE_CRITICAL + 50,
      });
      expect(s.hotTeams.map((t) => t.teamId)).toEqual(["huge", "mid"]);
      expect(s.hotTeams[0].size).toBeGreaterThan(s.hotTeams[1].size);
      // 小隊不該出現在需要關注的清單裡
      expect(s.hotTeams.find((t) => t.teamId === "small")).toBeUndefined();
    });

    it("全部都是小隊時清單為空", () => {
      const s = stats({ a: 5, b: 8, c: 12 });
      expect(s.hotTeams).toEqual([]);
    });
  });

  it("session 房間獨立計算、不影響隊伍風險判定", () => {
    const s = stats({ t1: 5 }, { s1: 300 });
    expect(s.largestSessionSize).toBe(300);
    expect(s.sessionRooms).toBe(1);
    expect(s.risk).toBe("ok"); // 風險只看隊伍扇出
  });
});
