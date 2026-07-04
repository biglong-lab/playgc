// 遊戲編輯器常數 - 單元測試
import { describe, it, expect } from "vitest";
import { PAGE_TYPES, PAGE_TEMPLATES, EVENT_TYPES, REWARD_TYPES, getPageTypeInfo } from "./constants";

describe("PAGE_TYPES", () => {
  it("至少涵蓋 81 種基準頁面類型（30 既有 + 21 階段A + 30 階段B）", () => {
    // ⚠️ 不寫死總數：元件庫持續擴充（2026-07 已達 98），寫死精確數字每次新增元件就會壞。
    // 只驗證「不低於歷史基準 81」防止元件被誤刪；唯一性由下方「value 不重複」測試把關。
    expect(PAGE_TYPES.length).toBeGreaterThanOrEqual(81);
  });

  it("包含 8 個多人核心工具元件（Phase 2 + 3.1 + 3.2 + 3.3 + 4）", () => {
    const values = PAGE_TYPES.map((pt) => pt.value);
    const multiTypes = [
      "photo_team",
      "vote_team",
      "shooting_team",
      "gps_team_mission",
      "choice_verify_race",
      "lock_coop",
      "relay_mission",
      "territory_capture",
    ];
    for (const v of multiTypes) {
      expect(values).toContain(v);
    }
  });

  it("包含階段 A 的 21 個互動模組（婚禮/破冰/團建/頒獎等商業情境）", () => {
    const values = PAGE_TYPES.map((pt) => pt.value);
    const phaseA = [
      "spot_vote", "team_dream", "group_nickname", "activity_memo",
      "peer_praise", "scale_check", "venue_rating", "micro_commit",
      "closing_thought", "gift_to_team", "ability_badge", "wedding_vow",
      "birthday_candle", "award_ceremony", "gratitude_tree", "dinner_table",
      "high_low_card", "role_board", "discovery_card", "flag_design", "party_menu",
    ];
    for (const v of phaseA) {
      expect(values).toContain(v);
    }
  });

  it("包含階段 B 的 30 個工作坊／回顧／投票工具", () => {
    const values = PAGE_TYPES.map((pt) => pt.value);
    const phaseB = [
      "jigsaw_puzzle", "treasure_hunt", "gps_cascade", "collective_score", "role_assign",
      "never_have_i_ever", "would_you_rather", "two_truths", "check_in", "speed_networking",
      "kpt_retro", "four_ls", "rose_bud_thorn",
      "team_pact", "team_health_check", "team_radar",
      "safety_check", "energy_map",
      "wish_wall", "idea_wall", "story_wall", "brain_dump",
      "dot_vote", "rank_choice", "multi_vote", "scaled_feedback",
      "thinking_hats", "host_word_cloud", "mad_libs", "quest_chain",
    ];
    for (const v of phaseB) {
      expect(values).toContain(v);
    }
  });

  it("每個類型都有 value、label、icon、color", () => {
    for (const pt of PAGE_TYPES) {
      expect(pt.value).toBeTruthy();
      expect(pt.label).toBeTruthy();
      expect(pt.icon).toBeDefined();
      expect(pt.color).toBeTruthy();
    }
  });

  it("value 不重複", () => {
    const values = PAGE_TYPES.map((pt) => pt.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("包含核心頁面類型", () => {
    const values = PAGE_TYPES.map((pt) => pt.value);
    const expected = [
      "text_card", "dialogue", "video", "button",
      "text_verify", "choice_verify", "shooting_mission",
      "photo_mission", "gps_mission", "qr_scan",
    ];
    for (const v of expected) {
      expect(values).toContain(v);
    }
  });
});

describe("getPageTypeInfo", () => {
  it("已知類型回傳正確資訊", () => {
    const textCard = getPageTypeInfo("text_card");
    expect(textCard.label).toBe("字卡");
    expect(textCard.value).toBe("text_card");
    expect(textCard.icon).toBeDefined();
    expect(textCard.color).toContain("blue");
  });

  it("對話類型回傳正確資訊", () => {
    const dialogue = getPageTypeInfo("dialogue");
    expect(dialogue.label).toBe("對話");
    expect(dialogue.color).toContain("purple");
  });

  it("射擊任務回傳正確資訊", () => {
    const shooting = getPageTypeInfo("shooting_mission");
    expect(shooting.label).toBe("射擊任務");
    expect(shooting.color).toContain("orange");
  });

  it("未知類型回傳預設值", () => {
    const unknown = getPageTypeInfo("unknown_type");
    expect(unknown.label).toBe("unknown_type");
    expect(unknown.color).toContain("gray");
  });

  it("空字串回傳預設值", () => {
    const empty = getPageTypeInfo("");
    expect(empty.label).toBe("");
    expect(empty.color).toContain("gray");
  });

  it("所有 PAGE_TYPES 都可以透過 getPageTypeInfo 查到", () => {
    for (const pt of PAGE_TYPES) {
      const info = getPageTypeInfo(pt.value);
      expect(info.label).toBe(pt.label);
      expect(info.color).toBe(pt.color);
    }
  });
});

describe("PAGE_TEMPLATES", () => {
  it("定義 5 組頁面模板", () => {
    expect(PAGE_TEMPLATES).toHaveLength(5);
  });

  it("每個模板都有 id、label、description、pages", () => {
    for (const tmpl of PAGE_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.label).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.pages.length).toBeGreaterThan(0);
    }
  });

  it("模板 ID 不重複", () => {
    const ids = PAGE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("模板頁面都有 pageType 和 config", () => {
    for (const tmpl of PAGE_TEMPLATES) {
      for (const page of tmpl.pages) {
        expect(page.pageType).toBeTruthy();
        expect(page.config).toBeDefined();
      }
    }
  });
});

describe("EVENT_TYPES", () => {
  it("定義 5 種事件類型", () => {
    expect(EVENT_TYPES).toHaveLength(5);
  });

  it("包含 qrcode、gps、shooting、photo、timer", () => {
    const values = EVENT_TYPES.map((e) => e.value);
    expect(values).toContain("qrcode");
    expect(values).toContain("gps");
    expect(values).toContain("shooting");
    expect(values).toContain("photo");
    expect(values).toContain("timer");
  });

  it("每個事件都有 description", () => {
    for (const evt of EVENT_TYPES) {
      expect(evt.description).toBeTruthy();
    }
  });
});

describe("REWARD_TYPES", () => {
  it("定義 4 種獎勵類型", () => {
    expect(REWARD_TYPES).toHaveLength(4);
  });

  it("包含 points、item、unlock_page、message", () => {
    const values = REWARD_TYPES.map((r) => r.value);
    expect(values).toContain("points");
    expect(values).toContain("item");
    expect(values).toContain("unlock_page");
    expect(values).toContain("message");
  });
});
