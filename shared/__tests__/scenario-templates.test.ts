import { describe, it, expect } from "vitest";
import {
  SCENARIO_TEMPLATES,
  SCENARIO_CATEGORY_LABELS,
  getScenarioById,
  getScenariosByCategory,
} from "../scenario-templates";

describe("SCENARIO_TEMPLATES 常數", () => {
  it("12 個情境（W6 D1 至少 11 個就位 + 1 個保留位）", () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(11);
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

  it("元件 axis 必須合法", () => {
    const allowed = ["host", "multi", "solo", "shared"];
    for (const s of SCENARIO_TEMPLATES) {
      for (const c of s.components) {
        expect(allowed).toContain(c.axis);
      }
    }
  });

  it("5 大分類都有對應 label", () => {
    expect(SCENARIO_CATEGORY_LABELS.public).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.corporate).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.event).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.venue).toBeTruthy();
    expect(SCENARIO_CATEGORY_LABELS.social).toBeTruthy();
  });

  it("婚禮模板必須含 PolaroidCollage / GuestbookDigital / EmojiReact", () => {
    const wedding = getScenarioById("wedding");
    expect(wedding).toBeDefined();
    const pageTypes = wedding!.components.map((c) => c.pageType);
    expect(pageTypes).toContain("host_polaroid_collage");
    expect(pageTypes).toContain("host_guestbook_digital");
    expect(pageTypes).toContain("host_emoji_react");
  });

  it("園遊會主舞台必須含 TriviaShowdown / LiveLeaderboard", () => {
    const carnival = getScenarioById("carnival-stage");
    expect(carnival).toBeDefined();
    const pageTypes = carnival!.components.map((c) => c.pageType);
    expect(pageTypes).toContain("host_trivia_showdown");
    expect(pageTypes).toContain("host_live_leaderboard");
  });

  it("街區走讀必須含 GpsCascade + KnowledgeMap", () => {
    const street = getScenarioById("street-walk");
    expect(street).toBeDefined();
    const pageTypes = street!.components.map((c) => c.pageType);
    expect(pageTypes).toContain("gps_cascade");
    expect(pageTypes).toContain("host_knowledge_map");
  });
});

describe("getScenarioById", () => {
  it("找到對應情境", () => {
    const wedding = getScenarioById("wedding");
    expect(wedding?.name).toBe("婚禮派對情境包");
  });

  it("找不到回傳 undefined", () => {
    expect(getScenarioById("non-existent")).toBeUndefined();
  });
});

describe("getScenariosByCategory", () => {
  it("交誼類至少 3 個（婚禮 / 生日 / 同學會）", () => {
    const social = getScenariosByCategory("social");
    expect(social.length).toBeGreaterThanOrEqual(3);
  });

  it("活動類至少 2 個", () => {
    const events = getScenariosByCategory("event");
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
