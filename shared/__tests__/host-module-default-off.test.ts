// 📺 2026-09-25 B-0 止血：活動現場大螢幕（HostScreen）預設關閉
//
// 依據：docs/changes/2026-09-25-hostscreen-stability-evaluation.md
//   生產 18 場全內部測試、6 月起全部 abandoned、觀測全盲；大螢幕互動改由 PhotoGo 提供。
//   CHITO 這邊：模組預設關 → 選單藏、API 擋、編輯器不列 host_*；super_admin 可對單一場域開。
import { describe, it, expect } from "vitest";
import {
  getModule,
  isModuleOn,
  isMenuPathOn,
  moduleForApiPath,
  resolveFieldModules,
} from "@shared/lib/module-registry";

describe("host 模組（活動現場大螢幕）預設關", () => {
  it("登錄表有 host 模組、預設關、依賴 games", () => {
    const def = getModule("host");
    expect(def).toBeDefined();
    expect(def?.defaultEnabled).toBe(false);
    expect(def?.dependsOn).toContain("games");
    expect(def?.required).toBeFalsy();
  });

  it("既有場域（沒設過）→ 關；沒有舊的 enableXxx 開關會偷偷把它打開", () => {
    expect(resolveFieldModules({}).host).toBe(false);
    expect(resolveFieldModules({ enableBattleArena: true, enableCompetitiveMode: true }).host).toBe(false);
    expect(isModuleOn(resolveFieldModules({}), "host")).toBe(false);
  });

  it("場域明確開啟 → 開（super_admin 對單一場域放行的路）", () => {
    const modules = resolveFieldModules({ modules: { host: true } });
    expect(isModuleOn(modules, "host")).toBe(true);
  });

  it("三條 API 前綴都對到 host 模組（後台建場、公開查場次、小問答）", () => {
    expect(moduleForApiPath("/api/admin/host-sessions")?.key).toBe("host");
    expect(moduleForApiPath("/api/admin/host-sessions/abc/end")?.key).toBe("host");
    expect(moduleForApiPath("/api/host-sessions/abc")?.key).toBe("host");
    expect(moduleForApiPath("/api/trivia/abc/answer")?.key).toBe("host");
  });

  it("不會誤傷相鄰路徑：遊戲 API 仍屬 games", () => {
    expect(moduleForApiPath("/api/admin/games")?.key).toBe("games");
    expect(moduleForApiPath("/api/games/x/pages")?.key).toBe("games");
  });

  it("選單：關 → /admin/host-sessions 藏；開 → 顯示", () => {
    expect(isMenuPathOn(resolveFieldModules({}), "/admin/host-sessions")).toBe(false);
    expect(isMenuPathOn(resolveFieldModules({ modules: { host: true } }), "/admin/host-sessions")).toBe(true);
  });
});
