// 遊戲模板 - 單元測試
import { describe, it, expect } from "vitest";
import {
  GAME_TEMPLATES,
  getTemplateById,
  type GameTemplate,
  type TemplatePageConfig,
} from "../game-templates";

describe("GAME_TEMPLATES 常數", () => {
  it("包含 6 個模板", () => {
    expect(GAME_TEMPLATES).toHaveLength(6);
  });

  it("每個模板有唯一 ID", () => {
    const ids = GAME_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每個模板包含必要欄位", () => {
    for (const tmpl of GAME_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.icon).toBeTruthy();
      expect(tmpl.maxPlayers).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(tmpl.difficulty);
      expect(tmpl.tags.length).toBeGreaterThan(0);
    }
  });

  it("空白模板沒有頁面", () => {
    const blank = GAME_TEMPLATES.find((t) => t.id === "blank");
    expect(blank).toBeDefined();
    expect(blank!.pages).toHaveLength(0);
    expect(blank!.estimatedTime).toBeNull();
  });

  it("非空白模板都有頁面", () => {
    const nonBlank = GAME_TEMPLATES.filter((t) => t.id !== "blank");
    for (const tmpl of nonBlank) {
      expect(tmpl.pages.length).toBeGreaterThan(0);
    }
  });

  it("每個頁面都有 pageType、title、config", () => {
    for (const tmpl of GAME_TEMPLATES) {
      for (const page of tmpl.pages) {
        expect(page.pageType).toBeTruthy();
        expect(page.title).toBeTruthy();
        expect(page.config).toBeDefined();
      }
    }
  });
});

describe("getTemplateById", () => {
  it("取得城市尋寶模板", () => {
    const tmpl = getTemplateById("city_treasure");
    expect(tmpl).toBeDefined();
    expect(tmpl!.name).toBe("城市尋寶");
  });

  it("取得密室解謎模板", () => {
    const tmpl = getTemplateById("escape_room");
    expect(tmpl).toBeDefined();
    expect(tmpl!.name).toBe("密室解謎");
  });

  it("取得每個模板都成功", () => {
    for (const expected of GAME_TEMPLATES) {
      const result = getTemplateById(expected.id);
      expect(result).toBeDefined();
      expect(result!.id).toBe(expected.id);
    }
  });

  it("不存在的 ID 回傳 undefined", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });

  it("空字串回傳 undefined", () => {
    expect(getTemplateById("")).toBeUndefined();
  });
});

describe("特定模板驗證", () => {
  it("城市尋寶包含 GPS 和拍照任務", () => {
    const tmpl = getTemplateById("city_treasure")!;
    const types = tmpl.pages.map((p) => p.pageType);
    expect(types).toContain("gps_mission");
    expect(types).toContain("photo_mission");
  });

  it("密室解謎包含文字驗證和密碼鎖", () => {
    const tmpl = getTemplateById("escape_room")!;
    const types = tmpl.pages.map((p) => p.pageType);
    expect(types).toContain("text_verify");
    expect(types).toContain("lock");
  });

  it("知識問答包含多個選擇驗證", () => {
    const tmpl = getTemplateById("quiz_game")!;
    const choicePages = tmpl.pages.filter(
      (p) => p.pageType === "choice_verify"
    );
    expect(choicePages.length).toBeGreaterThanOrEqual(3);
  });

  it("射擊挑戰包含射擊任務", () => {
    const tmpl = getTemplateById("shooting_challenge")!;
    const shootingPages = tmpl.pages.filter(
      (p) => p.pageType === "shooting_mission"
    );
    expect(shootingPages.length).toBeGreaterThanOrEqual(2);
  });

  it("團隊競賽包含投票頁面", () => {
    const tmpl = getTemplateById("team_competition")!;
    const types = tmpl.pages.map((p) => p.pageType);
    expect(types).toContain("vote");
  });
});
