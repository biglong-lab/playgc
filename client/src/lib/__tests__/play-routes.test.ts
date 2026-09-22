import { describe, it, expect } from "vitest";
import { isPlayFlowPath, isImmersivePath } from "../play-routes";

describe("isPlayFlowPath（遊玩流程中不跳全站彈窗）", () => {
  it("掃碼、遊戲、章節、組隊、賽事、地圖、活動互動都算遊玩流程", () => {
    const flow = [
      "/g/abc", "/f/JIACHUN/game/g1", "/game/g1", "/f/JIACHUN/game/g1/chapters",
      "/f/JIACHUN/game/g1/chapters/c1", "/f/JIACHUN/team/g1", "/team/g1",
      "/f/JIACHUN/match/g1", "/f/JIACHUN/map/g1", "/host/s1", "/play/s1", "/liff/play/s1",
    ];
    for (const p of flow) expect(isPlayFlowPath(p), p).toBe(true);
  });

  it("大廳、排行榜、我的頁面、首頁不算（提示照常）", () => {
    const normal = ["/", "/f", "/f/JIACHUN", "/f/JIACHUN/home", "/f/JIACHUN/leaderboard", "/f/JIACHUN/me", "/admin"];
    for (const p of normal) expect(isPlayFlowPath(p), p).toBe(false);
  });
});

describe("isImmersivePath 從 GlobalLegalFooter 搬移後行為不變", () => {
  it("遊玩中不掛 footer、章節列表照常掛", () => {
    expect(isImmersivePath("/f/JIACHUN/game/g1")).toBe(true);
    expect(isImmersivePath("/f/JIACHUN/game/g1/chapters")).toBe(false);
  });
});
