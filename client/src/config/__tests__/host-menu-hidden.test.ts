// 📺 2026-09-25：大螢幕互動（HostScreen）已整條移交 PhotoGo，CHITO 後台不再有「活動現場大螢幕」入口
//   守護：選單不得再出現 /admin/host-sessions（頁面已刪，出現就是死連結）
import { describe, it, expect } from "vitest";
import { ADMIN_MENU_GROUPS, filterMenuByModules } from "../admin-menu";

describe("後台選單：大螢幕互動已移除", () => {
  it("沒有任何項目指向 /admin/host-sessions 或 /host", () => {
    const paths = ADMIN_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    expect(paths.filter((p) => p.startsWith("/admin/host") || p.startsWith("/host"))).toEqual([]);
  });

  it("沒有任何項目掛在已移除的 host 模組上", () => {
    const items = ADMIN_MENU_GROUPS.flatMap((g) => g.items);
    expect(items.filter((i) => (i.requiresModule as string | undefined) === "host")).toEqual([]);
  });

  it("模組過濾不因缺少 host 鍵而漏掉其他項目", () => {
    const base = { shooting: true, battle: true, chapters: true, photo: true, gps: true, payment: true };
    const titles = filterMenuByModules(ADMIN_MENU_GROUPS, base).flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toContain("遊戲管理");
  });
});
