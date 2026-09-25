// 📺 2026-09-25：大螢幕互動（host 軸）已整條移交 PhotoGo，
//   6 個純 host 情境（wedding / birthday / reunion / carnival-stage / icebreaker / awards-ceremony）
//   已從模板移除、7 個混合情境拔掉 host 元件；本測試守護「模板裡不再有 host 軸」。
import { describe, it, expect } from "vitest";
import {
  SCENARIO_TEMPLATES,
  SCENARIO_CATEGORY_LABELS,
  getScenarioById,
  getScenariosByCategory,
  getScenariosForPageType,
} from "../scenario-templates";

const REMOVED_HOST_SCENARIOS = [
  "wedding",
  "birthday",
  "reunion",
  "carnival-stage",
  "icebreaker",
  "awards-ceremony",
];

describe("SCENARIO_TEMPLATES 常數", () => {
  it("恰好 7 個場域遊戲情境（host 軸移交 PhotoGo 後）", () => {
    expect(SCENARIO_TEMPLATES.length).toBe(7);
    expect(SCENARIO_TEMPLATES.map((s) => s.id).sort()).toEqual(
      [
        "street-walk",
        "district-checkin",
        "corporate-training",
        "company-trip",
        "kids-adventure",
        "venue-storyline",
        "shooting-arena",
      ].sort(),
    );
  });

  it("6 個純 host 情境已移除（移交 PhotoGo）", () => {
    for (const id of REMOVED_HOST_SCENARIOS) {
      expect(getScenarioById(id), id).toBeUndefined();
    }
  });

  it("守護：所有情境的元件都不是 host 軸、pageType 不以 host_ 開頭", () => {
    for (const s of SCENARIO_TEMPLATES) {
      for (const c of s.components) {
        expect(c.axis as string, `${s.id}/${c.pageType} axis`).not.toBe("host");
        expect(c.pageType.startsWith("host_"), `${s.id}/${c.pageType}`).toBe(false);
      }
    }
  });

  it("親子冒險情境（W7 D1 新）必含 TreasureHunt + JigsawPuzzle", () => {
    const kids = getScenarioById("kids-adventure");
    expect(kids).toBeDefined();
    const pageTypes = kids!.components.map((c) => c.pageType);
    expect(pageTypes).toContain("treasure_hunt");
    expect(pageTypes).toContain("jigsaw_puzzle");
    expect(pageTypes).toHaveLength(2);
  });

  it("ID 不重複", () => {
    const ids = SCENARIO_TEMPLATES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每個情境必須有 5 個必要欄位", () => {
    for (const s of SCENARIO_TEMPLATES) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.tagline).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.components.length).toBeGreaterThan(0);
    }
  });

  it("每個情境至少含 1 個元件", () => {
    for (const s of SCENARIO_TEMPLATES) {
      expect(s.components.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("狀態必須是 live / preview / planned 之一", () => {
    for (const s of SCENARIO_TEMPLATES) {
      expect(["live", "preview", "planned"]).toContain(s.status);
    }
  });

  it("分類必須是 5 大類之一", () => {
    const allowed = ["public", "corporate", "event", "venue", "social"];
    for (const s of SCENARIO_TEMPLATES) {
      expect(allowed).toContain(s.category);
    }
  });

  it("元件 axis 必須合法（multi / solo / shared）", () => {
    const allowed = ["multi", "solo", "shared"];
    for (const s of SCENARIO_TEMPLATES) {
      for (const c of s.components) {
        expect(allowed).toContain(c.axis);
      }
    }
  });

  it("5 大分類都有對應 label（event / social 型別保留、目前無情境）", () => {
    expect(SCENARIO_CATEGORY_LABELS.public).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.corporate).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.event).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.venue).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.social).toBeTruthy();
  });

  it("文案不再提到大螢幕 / 投影 / 免登入（host 賣點已移交 PhotoGo）", () => {
    const RE = /大螢幕|投影|免登入/;
    for (const s of SCENARIO_TEMPLATES) {
      const text = [s.tagline, s.description, ...s.components.map((c) => c.role)].join("\n");
      expect(RE.test(text), `${s.id} 文案仍含 host 賣點`).toBe(false);
    }
  });

  it("街區走讀只剩 GpsCascade", () => {
    const street = getScenarioById("street-walk");
    expect(street).toBeDefined();
    expect(street!.components.map((c) => c.pageType)).toEqual(["gps_cascade"]);
  });

  it("商圈打卡只剩 TreasureHunt", () => {
    const district = getScenarioById("district-checkin");
    expect(district).toBeDefined();
    expect(district!.components.map((c) => c.pageType)).toEqual(["treasure_hunt"]);
  });

  it("企業內訓 8 個元件（拔掉搶答 / 即時投票）", () => {
    const corp = getScenarioById("corporate-training");
    expect(corp).toBeDefined();
    expect(corp!.components).toHaveLength(8);
    expect(corp!.components.map((c) => c.pageType)).toContain("role_assign");
    expect(corp!.components.map((c) => c.pageType)).toContain("rank_choice");
  });

  it("員工旅遊 4 / 場域故事 2 / 實體打擊 2 個元件", () => {
    expect(getScenarioById("company-trip")!.components).toHaveLength(4);
    expect(getScenarioById("venue-storyline")!.components).toHaveLength(2);
    expect(getScenarioById("shooting-arena")!.components).toHaveLength(2);
  });
});

describe("getScenarioById", () => {
  it("找到對應情境", () => {
    const street = getScenarioById("street-walk");
    expect(street?.name).toBe("街區走讀情境包");
  });

  it("找不到回傳 undefined", () => {
    expect(getScenarioById("non-existent")).toBeUndefined();
  });
});

describe("getScenariosForPageType（W7 D2 反向索引）", () => {
  it("treasure_hunt 出現在親子冒險 + 商圈打卡 + 場域故事", () => {
    const ids = getScenariosForPageType("treasure_hunt").map((s) => s.id);
    expect(ids).toContain("kids-adventure");
    expect(ids).toContain("district-checkin");
    expect(ids).toContain("venue-storyline");
  });

  it("host_* pageType 一律回傳空陣列（已移交 PhotoGo）", () => {
    expect(getScenariosForPageType("host_emoji_react")).toEqual([]);
    expect(getScenariosForPageType("host_polaroid_collage")).toEqual([]);
    expect(getScenariosForPageType("host_poll_live")).toEqual([]);
  });

  it("不存在的 pageType 回傳空陣列", () => {
    expect(getScenariosForPageType("non_existent_type")).toEqual([]);
  });
});

describe("getScenariosByCategory", () => {
  it("公部門 2 / 私部門 2 / 空間 3", () => {
    expect(getScenariosByCategory("public")).toHaveLength(2);
    expect(getScenariosByCategory("corporate")).toHaveLength(2);
    expect(getScenariosByCategory("venue")).toHaveLength(3);
  });

  it("交誼類 / 活動類已無情境（移交 PhotoGo）", () => {
    expect(getScenariosByCategory("social")).toEqual([]);
    expect(getScenariosByCategory("event")).toEqual([]);
  });
});
