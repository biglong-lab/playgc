// 遊戲模組庫 - 單元測試
import { describe, it, expect } from "vitest";
import {
  GAME_MODULES,
  getModuleById,
  getAllModules,
  getModulesByCategory,
  MODULE_CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  type GameModule,
  type ModuleCategory,
} from "../game-modules";

describe("GAME_MODULES 常數", () => {
  it("包含 5 套模組", () => {
    expect(GAME_MODULES).toHaveLength(5);
  });

  it("每個模組都有唯一 ID", () => {
    const ids = GAME_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每個模組包含所有必要欄位", () => {
    for (const mod of GAME_MODULES) {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(mod.icon).toBeTruthy();
      expect(mod.category).toBeTruthy();
      expect(mod.scenario).toBeTruthy();
      expect(mod.coverEmoji).toBeTruthy();
      expect(mod.flowDescription).toBeTruthy();
      expect(mod.tags.length).toBeGreaterThan(0);
      expect(mod.highlights.length).toBeGreaterThanOrEqual(3);
      expect(mod.pages.length).toBeGreaterThanOrEqual(7);
    }
  });

  it("每個模組的 difficulty 是有效值", () => {
    const validDifficulties = ["easy", "medium", "hard"];
    for (const mod of GAME_MODULES) {
      expect(validDifficulties).toContain(mod.difficulty);
    }
  });

  it("每個模組的 category 是有效值", () => {
    const validCategories: ModuleCategory[] = [
      "outdoor", "indoor", "education", "team", "digital",
    ];
    for (const mod of GAME_MODULES) {
      expect(validCategories).toContain(mod.category);
    }
  });

  it("每個模組的頁面都有 pageType 和 title", () => {
    for (const mod of GAME_MODULES) {
      for (const page of mod.pages) {
        expect(page.pageType).toBeTruthy();
        expect(page.title).toBeTruthy();
      }
    }
  });

  it("maxPlayers 為正整數", () => {
    for (const mod of GAME_MODULES) {
      expect(mod.maxPlayers).toBeGreaterThan(0);
      expect(Number.isInteger(mod.maxPlayers)).toBe(true);
    }
  });

  it("estimatedTime 為正數或 null", () => {
    for (const mod of GAME_MODULES) {
      if (mod.estimatedTime !== null) {
        expect(mod.estimatedTime).toBeGreaterThan(0);
      }
    }
  });
});

describe("getModuleById", () => {
  it("根據 ID 取得正確模組", () => {
    const mod = getModuleById("outdoor_treasure_hunt");
    expect(mod).toBeDefined();
    expect(mod!.name).toBe("古鎮尋寶奇遇記");
    expect(mod!.category).toBe("outdoor");
  });

  it("取得每個模組都正確", () => {
    for (const expected of GAME_MODULES) {
      const result = getModuleById(expected.id);
      expect(result).toBeDefined();
      expect(result!.id).toBe(expected.id);
      expect(result!.name).toBe(expected.name);
    }
  });

  it("不存在的 ID 回傳 undefined", () => {
    expect(getModuleById("nonexistent")).toBeUndefined();
    expect(getModuleById("")).toBeUndefined();
  });
});

describe("getAllModules", () => {
  it("回傳所有 5 套模組", () => {
    const modules = getAllModules();
    expect(modules).toHaveLength(5);
  });

  it("回傳的是 GAME_MODULES 的引用", () => {
    expect(getAllModules()).toBe(GAME_MODULES);
  });
});

describe("getModulesByCategory", () => {
  it("篩選戶外探索模組", () => {
    const outdoor = getModulesByCategory("outdoor");
    expect(outdoor.length).toBeGreaterThanOrEqual(1);
    for (const mod of outdoor) {
      expect(mod.category).toBe("outdoor");
    }
  });

  it("篩選室內解謎模組", () => {
    const indoor = getModulesByCategory("indoor");
    expect(indoor.length).toBeGreaterThanOrEqual(1);
    for (const mod of indoor) {
      expect(mod.category).toBe("indoor");
    }
  });

  it("篩選教育學習模組", () => {
    const education = getModulesByCategory("education");
    expect(education.length).toBeGreaterThanOrEqual(1);
    for (const mod of education) {
      expect(mod.category).toBe("education");
    }
  });

  it("篩選團隊競技模組", () => {
    const team = getModulesByCategory("team");
    expect(team.length).toBeGreaterThanOrEqual(1);
    for (const mod of team) {
      expect(mod.category).toBe("team");
    }
  });

  it("篩選數位互動模組", () => {
    const digital = getModulesByCategory("digital");
    expect(digital.length).toBeGreaterThanOrEqual(1);
    for (const mod of digital) {
      expect(mod.category).toBe("digital");
    }
  });

  it("所有分類加總等於總模組數", () => {
    const categories: ModuleCategory[] = [
      "outdoor", "indoor", "education", "team", "digital",
    ];
    const total = categories.reduce(
      (sum, cat) => sum + getModulesByCategory(cat).length,
      0
    );
    expect(total).toBe(GAME_MODULES.length);
  });
});

describe("MODULE_CATEGORY_LABELS", () => {
  it("每個分類都有中文標籤", () => {
    expect(MODULE_CATEGORY_LABELS.outdoor).toBe("戶外探索");
    expect(MODULE_CATEGORY_LABELS.indoor).toBe("室內解謎");
    expect(MODULE_CATEGORY_LABELS.education).toBe("教育學習");
    expect(MODULE_CATEGORY_LABELS.team).toBe("團隊競技");
    expect(MODULE_CATEGORY_LABELS.digital).toBe("數位互動");
  });

  it("覆蓋所有 5 個分類", () => {
    expect(Object.keys(MODULE_CATEGORY_LABELS)).toHaveLength(5);
  });
});

describe("DIFFICULTY_LABELS", () => {
  it("每個難度都有中文標籤", () => {
    expect(DIFFICULTY_LABELS.easy).toBe("簡單");
    expect(DIFFICULTY_LABELS.medium).toBe("中等");
    expect(DIFFICULTY_LABELS.hard).toBe("困難");
  });
});

describe("模組頁面類型驗證", () => {
  const VALID_PAGE_TYPES = [
    "text_card", "dialogue", "video", "button",
    "text_verify", "choice_verify", "conditional_verify",
    "shooting_mission", "photo_mission", "gps_mission",
    "qr_scan", "time_bomb", "lock", "motion_challenge", "vote",
  ];

  it("所有模組使用的 pageType 都是有效值", () => {
    for (const mod of GAME_MODULES) {
      for (const page of mod.pages) {
        expect(VALID_PAGE_TYPES).toContain(page.pageType);
      }
    }
  });

  it("每個模組使用至少 3 種不同的 pageType", () => {
    for (const mod of GAME_MODULES) {
      const uniqueTypes = new Set(mod.pages.map((p) => p.pageType));
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(3);
    }
  });
});
