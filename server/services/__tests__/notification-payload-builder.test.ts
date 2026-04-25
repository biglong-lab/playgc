// notification-payload-builder 純函式測試
import { describe, it, expect } from "vitest";
import {
  buildLineNotifyMessage,
  buildLineOaMessage,
  buildDiscordEmbed,
  buildGenericWebhookPayload,
  buildDormancyMessage,
  buildTierUpgradeMessage,
  buildFirstGameMessage,
  buildRewardIssuedMessage,
} from "../notification-payload-builder";

// ============================================================================
// LINE Notify
// ============================================================================
describe("buildLineNotifyMessage", () => {
  it("僅 title + body", () => {
    expect(buildLineNotifyMessage({ title: "獎勵", body: "你獲得 50 元" })).toBe(
      "[獎勵]\n你獲得 50 元",
    );
  });

  it("含 deepLink", () => {
    expect(
      buildLineNotifyMessage({
        title: "獎勵",
        body: "你獲得 50 元",
        deepLink: "https://game.homi.cc/me/rewards",
      }),
    ).toBe("[獎勵]\n你獲得 50 元\nhttps://game.homi.cc/me/rewards");
  });
});

// ============================================================================
// LINE OA
// ============================================================================
describe("buildLineOaMessage", () => {
  it("回 type=text 格式", () => {
    const result = buildLineOaMessage({ title: "Hi", body: "test" });
    expect(result).toEqual({ type: "text", text: "[Hi]\ntest" });
  });
});

// ============================================================================
// Discord
// ============================================================================
describe("buildDiscordEmbed", () => {
  it("回 embeds 陣列", () => {
    const result = buildDiscordEmbed({
      title: "標題",
      body: "內容",
      deepLink: "https://example.com",
    });
    expect(result.embeds).toHaveLength(1);
    expect(result.embeds[0]).toMatchObject({
      title: "標題",
      description: "內容",
      url: "https://example.com",
      color: 0x3b82f6,
    });
  });

  it("沒 deepLink → url undefined", () => {
    const result = buildDiscordEmbed({ title: "x", body: "y" });
    expect(result.embeds[0].url).toBeUndefined();
  });
});

// ============================================================================
// Generic Webhook
// ============================================================================
describe("buildGenericWebhookPayload", () => {
  it("含完整欄位", () => {
    const result = buildGenericWebhookPayload({
      eventType: "first_game",
      fieldId: "jiachun",
      squadId: "s1",
      userId: "u1",
      payload: { title: "test", body: "hi" },
    });
    expect(result).toMatchObject({
      event: "first_game",
      fieldId: "jiachun",
      squadId: "s1",
      userId: "u1",
      title: "test",
      body: "hi",
    });
    expect(result.timestamp).toBeDefined();
  });
});

// ============================================================================
// Dormancy
// ============================================================================
describe("buildDormancyMessage", () => {
  it("3 天 → 想念你", () => {
    const msg = buildDormancyMessage(3);
    expect(msg.title).toContain("想念");
  });

  it("4 天 → 進入限時福利階段（介於 3-7 內）", () => {
    const msg = buildDormancyMessage(4);
    // 4 天 > 3，所以走 <= 7 階段（限時福利）
    expect(msg.title).toContain("限時福利");
  });

  it("7 天 → 限時福利", () => {
    const msg = buildDormancyMessage(7);
    expect(msg.title).toContain("限時福利");
  });

  it("14 天 → 最後機會", () => {
    const msg = buildDormancyMessage(14);
    expect(msg.title).toContain("最後機會");
  });

  it("30 天 → 久違了", () => {
    const msg = buildDormancyMessage(30);
    expect(msg.title).toContain("久違了");
  });

  it("body 包含天數", () => {
    expect(buildDormancyMessage(20).body).toContain("20");
  });
});

// ============================================================================
// Tier Upgrade
// ============================================================================
describe("buildTierUpgradeMessage", () => {
  it("各段位中文化", () => {
    expect(buildTierUpgradeMessage("bronze").title).toContain("青銅");
    expect(buildTierUpgradeMessage("silver").title).toContain("白銀");
    expect(buildTierUpgradeMessage("gold").title).toContain("黃金");
    expect(buildTierUpgradeMessage("diamond").title).toContain("鑽石");
    expect(buildTierUpgradeMessage("master").title).toContain("名人");
  });

  it("未知段位 → 直接顯示原值", () => {
    expect(buildTierUpgradeMessage("legendary").title).toContain("legendary");
  });
});

// ============================================================================
// First Game
// ============================================================================
describe("buildFirstGameMessage", () => {
  it("含「上榜啦」+ 名次", () => {
    const msg = buildFirstGameMessage(5);
    expect(msg.title).toContain("上榜啦");
    expect(msg.body).toContain("第 5");
  });
});

// ============================================================================
// Reward Issued
// ============================================================================
describe("buildRewardIssuedMessage", () => {
  it("含獎勵名稱", () => {
    const msg = buildRewardIssuedMessage("新人賀禮 50 元");
    expect(msg.title).toContain("獎勵");
    expect(msg.body).toContain("新人賀禮 50 元");
    expect(msg.deepLink).toBe("/me/rewards");
  });
});
