// 全站宣告 footer 路徑排除規則（CHITO c45e8915）
import { describe, it, expect } from "vitest";
import { isImmersivePath } from "@/components/shared/GlobalLegalFooter";

describe("isImmersivePath", () => {
  it("沉浸式頁面 → 不掛 footer", () => {
    const immersive = [
      "/game/abc-123",
      "/f/HPSPACE/game/abc-123",
      "/map/abc-123",
      "/f/HPSPACE/map/abc-123",
      "/host/session-1",
      "/play/session-1",
      "/liff/play/session-1",
      "/pos/scan",
      "/g/my-slug",
      "/j/ABC123",
      "/b/ABC123",
    ];
    for (const p of immersive) expect(isImmersivePath(p), p).toBe(true);
  });

  it("一般頁面 → 要掛 footer", () => {
    const normal = [
      "/",
      "/home",
      "/leaderboard",
      "/legal",
      "/legal/privacy",
      "/f/HPSPACE",
      "/f/HPSPACE/home",
      "/f/HPSPACE/me",
      "/f/HPSPACE/game/abc-123/chapters", // 章節選單可捲動
      "/template-market",
      "/admin/login",
      "/admin/games",
      "/pos", // POS 主控台（非掃碼相機頁）
      "/pos/checkout",
      "/battle",
      "/me/photos",
    ];
    for (const p of normal) expect(isImmersivePath(p), p).toBe(false);
  });
});
