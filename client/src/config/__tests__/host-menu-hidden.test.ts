// 📺 2026-09-25 B-0 止血：host 模組關 → 後台選單不出現「活動現場大螢幕」（看不到就打不到）
import { describe, it, expect } from "vitest";
import { ADMIN_MENU_GROUPS, filterMenuByModules } from "../admin-menu";

const titles = (groups: ReturnType<typeof filterMenuByModules>) =>
  groups.flatMap((g) => g.items.map((i) => i.title));

describe("後台選單：活動現場大螢幕", () => {
  it("選單項目掛在 host 模組上（不是無條件顯示）", () => {
    const item = ADMIN_MENU_GROUPS.flatMap((g) => g.items).find((i) => i.path === "/admin/host-sessions");
    expect(item).toBeDefined();
    expect(item?.requiresModule).toBe("host");
    expect(item?.title).toBe("活動現場大螢幕");
  });

  it("場域模組載入後 host=false → 藏；host=true → 顯示", () => {
    const base = { shooting: true, battle: true, chapters: true, photo: true, gps: true, payment: true };
    expect(titles(filterMenuByModules(ADMIN_MENU_GROUPS, { ...base, host: false }))).not.toContain("活動現場大螢幕");
    expect(titles(filterMenuByModules(ADMIN_MENU_GROUPS, { ...base, host: true }))).toContain("活動現場大螢幕");
  });

  it("模組還沒載入（undefined）→ 暫時全顯示，避免閃爍（既有規則不變）", () => {
    expect(titles(filterMenuByModules(ADMIN_MENU_GROUPS, undefined))).toContain("活動現場大螢幕");
  });
});
