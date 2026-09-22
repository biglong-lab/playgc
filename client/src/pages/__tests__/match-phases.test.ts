// 🏁 賽事畫面判斷（純函式）：大廳狀態 / 遊戲頁階段 / 接力頁碼切片 / 剩餘時間
import { describe, it, expect } from "vitest";
import { resolveMatchStatus, resolveLobbyView, isParticipantOf, buildMatchInviteUrl } from "../match-lobby/lobby-status";
import { resolvePlayPhase, playInfoOf, slicePagesForLeg } from "../match-play/play-phase";
import { remainingSeconds, type MyMatchState } from "@/lib/match-types";

function me(overrides: Partial<MyMatchState> = {}): MyMatchState {
  return {
    matchId: "m1", gameId: "g1", matchMode: "competitive", status: "playing", isParticipant: true, sessionId: null,
    completed: false, myRank: 1, myScore: 0, participantCount: 2, startedAt: null, timeLimitSeconds: null, relay: null,
    ...overrides,
  };
}

describe("resolveMatchStatus / resolveLobbyView", () => {
  it("WS 比輪詢快 → 取進度較後者；狀態不倒退；取消優先", () => {
    expect(resolveMatchStatus("waiting", "countdown")).toBe("countdown");
    expect(resolveMatchStatus("playing", "countdown")).toBe("playing");
    expect(resolveMatchStatus("finished", null)).toBe("finished");
    expect(resolveMatchStatus("cancelled", "playing")).toBe("cancelled");
  });

  it("沒選賽事 → 列表；有賽事但詳情還沒到 → 載入", () => {
    expect(resolveLobbyView({ isLoading: false, matchId: null, detail: undefined, wsStatus: null })).toBe("browse");
    expect(resolveLobbyView({ isLoading: false, matchId: "m1", detail: undefined, wsStatus: null })).toBe("loading");
  });

  it("參賽者判斷 / 邀請連結", () => {
    const detail = { ranking: [{ userId: "u1" }] } as never;
    expect(isParticipantOf(detail, "u1")).toBe(true);
    expect(isParticipantOf(detail, "u2")).toBe(false);
    expect(buildMatchInviteUrl("https://game.homi.cc", "/f/JIACHUN/match/g1", "AB CD")).toBe("https://game.homi.cc/f/JIACHUN/match/g1?code=AB%20CD");
  });
});

describe("resolvePlayPhase", () => {
  it("不是參賽者 / 不在進行中 → 回大廳", () => {
    expect(resolvePlayPhase(me({ isParticipant: false }))).toBe("to_lobby");
    expect(resolvePlayPhase(me({ status: "countdown" }))).toBe("to_lobby");
    expect(resolvePlayPhase(me({ status: "finished" }))).toBe("to_lobby");
    expect(resolvePlayPhase(undefined)).toBe("loading");
  });

  it("競賽：還沒完成 → 玩；完成 → 等其他人", () => {
    expect(resolvePlayPhase(me())).toBe("play");
    expect(resolvePlayPhase(me({ completed: true }))).toBe("done_waiting");
  });

  it("接力：當棒 → 玩；待命 → 等輪到我；完成 → 等隊友", () => {
    const relay = (status: "pending" | "active" | "completed") =>
      me({ matchMode: "relay", relay: { status, segment: 2, totalSegments: 3, fromPage: 3, toPage: 4, activeSegment: 1 } });
    expect(resolvePlayPhase(relay("active"))).toBe("play");
    expect(resolvePlayPhase(relay("pending"))).toBe("waiting_turn");
    expect(resolvePlayPhase(relay("completed"))).toBe("done_waiting");
  });
});

describe("playInfoOf / slicePagesForLeg", () => {
  it("接力帶頁碼範圍、競賽不帶；已綁定場次一起帶", () => {
    const relayMe = me({ matchMode: "relay", sessionId: "s1", relay: { status: "active", segment: 2, totalSegments: 2, fromPage: 3, toPage: 5, activeSegment: 2 } });
    expect(playInfoOf(relayMe)).toEqual({ matchId: "m1", sessionId: "s1", pageRange: { fromPage: 3, toPage: 5 } });
    expect(playInfoOf(me()).pageRange).toBeNull();
  });

  it("只留自己那段（1-based 含頭尾）；沒有範圍 = 全部", () => {
    const pages = ["p1", "p2", "p3", "p4", "p5", "p6"];
    expect(slicePagesForLeg(pages, { fromPage: 3, toPage: 5 })).toEqual(["p3", "p4", "p5"]);
    expect(slicePagesForLeg(pages, null)).toEqual(pages);
  });
});

describe("remainingSeconds", () => {
  it("不限時 → null；超時 → 0；進行中 → 無條件進位的剩餘秒", () => {
    const start = "2026-09-23T10:00:00.000Z";
    const t0 = new Date(start).getTime();
    expect(remainingSeconds(start, null, t0)).toBeNull();
    expect(remainingSeconds(start, 300, t0 + 299_500)).toBe(1);
    expect(remainingSeconds(start, 300, t0 + 400_000)).toBe(0);
  });
});
