// 🧩 模組登錄表（前後端共用）：開關解析、API 路徑對應、選單與排程
import { describe, it, expect } from "vitest";
import {
  MODULE_REGISTRY, getModule, isModuleOn, isCronOn, isMenuPathOn, moduleForApiPath, resolveFieldModules,
} from "../lib/module-registry";

describe("模組登錄表", () => {
  it("每個模組都有說明、路徑前綴以 /api 開頭、key 不重複", () => {
    const keys = MODULE_REGISTRY.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of MODULE_REGISTRY) {
      expect(m.label.trim()).not.toBe("");
      expect(m.description.trim()).not.toBe("");
      expect(m.apiPrefixes.every((p) => p.startsWith("/api"))).toBe(true);
    }
  });

  it("核心模組（遊戲）不能被關掉", () => {
    expect(getModule("games")?.required).toBe(true);
    expect(isModuleOn({ games: false }, "games")).toBe(true);
  });

  it("沒設定 → 用預設值；設定 false → 關", () => {
    expect(isModuleOn({}, "pos")).toBe(true);
    expect(isModuleOn({ pos: false }, "pos")).toBe(false);
    expect(isModuleOn({}, "devices")).toBe(false); // 硬體預設不開
  });

  it("不在登錄表的 key 不擋（打錯字不會整條路壞掉）", () => {
    expect(isModuleOn({}, "not-a-module")).toBe(true);
  });
});

describe("resolveFieldModules（優先序：新設定 > 舊 enableXxx > 預設）", () => {
  it("沿用舊開關：場域已關掉水彈 → 新機制也是關", () => {
    expect(resolveFieldModules({ enableBattleArena: false }).battle).toBe(false);
    expect(resolveFieldModules({ enableCompetitiveMode: false }).match).toBe(false);
  });

  it("新設定優先於舊開關", () => {
    expect(resolveFieldModules({ enableBattleArena: false, modules: { battle: true } }).battle).toBe(true);
  });

  it("都沒設定 → 登錄表預設", () => {
    const r = resolveFieldModules(null);
    expect(r.pos).toBe(true);
    expect(r.devices).toBe(false);
  });
});

describe("API 路徑 / 選單 / 排程對應", () => {
  it("最長前綴優先：/api/admin/pos 對到 pos、/api/admin/games 對到核心", () => {
    expect(moduleForApiPath("/api/admin/pos/products")?.key).toBe("pos");
    expect(moduleForApiPath("/api/matches/abc")?.key).toBe("match");
    expect(moduleForApiPath("/api/admin/games/123")?.key).toBe("games");
    expect(moduleForApiPath("/api/unknown")).toBeUndefined();
  });

  it("選單：模組關掉 → 對應路徑藏起來；其他路徑照常", () => {
    expect(isMenuPathOn({ pos: false }, "/pos/checkout")).toBe(false);
    expect(isMenuPathOn({ pos: false }, "/admin/games")).toBe(true);
  });

  it("排程：模組關掉 → 對應 cron 跳過", () => {
    expect(isCronOn({ booking: false }, "booking-reminder")).toBe(false);
    expect(isCronOn({ booking: true }, "booking-reminder")).toBe(true);
    expect(isCronOn({ booking: false }, "other-cron")).toBe(true);
  });

  it("🐛 2026-09-26 回歸：已開射擊任務的場域，硬體裝置模組視為開（不能擋靶機管理）", () => {
    expect(isModuleOn(resolveFieldModules({ enableShootingMission: true }), "devices")).toBe(true);
    expect(isModuleOn(resolveFieldModules({}), "devices")).toBe(false);
    expect(isModuleOn(resolveFieldModules({ enableShootingMission: true, modules: { devices: false } }), "devices")).toBe(false);
  });
});
