// 🛡️ 主題化 config 防呆測試（2026-06-13）
//
// 📺 2026-09-25：host 軸情境 / 元件已移交 PhotoGo，host_* 形狀測試一併移除
//
// 確保 7 情境元件的 config：
//   1. 形狀吻合各 pageType renderer 期望（填錯 key → 畫面空白，這裡擋掉）
//   2. 不殘留佔位字串（範例:/1+1=/選項 A/答案 1/請 admin 編輯）
//      → admin 一鍵建場(default)後即主題化可用

import { describe, it, expect } from "vitest";
import { SCENARIO_TEMPLATES } from "../scenario-templates";

const withConfig = SCENARIO_TEMPLATES.flatMap((s) =>
  s.components
    .filter((c) => c.config)
    .map((c) => ({ scenario: s.id, pageType: c.pageType, label: c.label, config: c.config! })),
);

describe("情境主題化 config", () => {
  it("至少 12 個元件帶主題化 config", () => {
    expect(withConfig.length).toBeGreaterThanOrEqual(12);
  });

  it("沒有殘留佔位字串", () => {
    const PLACEHOLDER = /範例[:：]|1\+1=|選項 [A-D]|答案 [0-9]|請 admin 編輯|角色 [A-C]\b/;
    const offenders = withConfig
      .filter((c) => PLACEHOLDER.test(JSON.stringify(c.config)))
      .map((c) => `${c.scenario}/${c.pageType}`);
    expect(offenders, `仍含佔位字串：\n${offenders.join("\n")}`).toEqual([]);
  });

  it("treasure_hunt config 形狀正確（clues[{id,prompt,answer}]）", () => {
    for (const c of withConfig.filter((x) => x.pageType === "treasure_hunt")) {
      const cfg = c.config as { clues?: Array<{ id?: unknown; prompt?: unknown; answer?: unknown }> };
      expect(Array.isArray(cfg.clues), `${c.scenario} clues`).toBe(true);
      cfg.clues!.forEach((cl) => {
        expect(typeof cl.id).toBe("string");
        expect(typeof cl.prompt).toBe("string");
        expect(typeof cl.answer).toBe("string");
      });
    }
  });

  it("gps_cascade config 形狀正確（points[{id,name,hint}]）", () => {
    for (const c of withConfig.filter((x) => x.pageType === "gps_cascade")) {
      const cfg = c.config as { points?: Array<{ id?: unknown; name?: unknown }> };
      expect(Array.isArray(cfg.points)).toBe(true);
      cfg.points!.forEach((p) => {
        expect(typeof p.id).toBe("string");
        expect(typeof p.name).toBe("string");
      });
    }
  });

  it("role_assign config 形狀正確（roles[{id,name}]）", () => {
    for (const c of withConfig.filter((x) => x.pageType === "role_assign")) {
      const cfg = c.config as { roles?: Array<{ id?: unknown; name?: unknown }> };
      expect(Array.isArray(cfg.roles)).toBe(true);
      cfg.roles!.forEach((r) => {
        expect(typeof r.id).toBe("string");
        expect(typeof r.name).toBe("string");
      });
    }
  });

  it("would_you_rather config 形狀正確（optionA/optionB）", () => {
    for (const c of withConfig.filter((x) => x.pageType === "would_you_rather")) {
      const cfg = c.config as { optionA?: unknown; optionB?: unknown };
      expect(typeof cfg.optionA).toBe("string");
      expect(typeof cfg.optionB).toBe("string");
    }
  });
});
