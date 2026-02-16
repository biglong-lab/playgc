import { describe, it, expect } from "vitest";
import { insertGameSchema, insertPageSchema, insertItemSchema, insertEventSchema } from "../games";

describe("insertGameSchema", () => {
  it("接受有效的遊戲資料", () => {
    const validGame = {
      title: "測試遊戲",
      description: "這是一個測試遊戲",
      difficulty: "medium",
      estimatedTime: 60,
      maxPlayers: 10,
      status: "draft",
    };

    const result = insertGameSchema.safeParse(validGame);
    expect(result.success).toBe(true);
  });

  it("僅需 title 即可通過驗證", () => {
    const minimalGame = { title: "最小遊戲" };
    const result = insertGameSchema.safeParse(minimalGame);
    expect(result.success).toBe(true);
  });

  it("拒絕沒有 title 的資料", () => {
    const noTitle = { description: "缺少標題" };
    const result = insertGameSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("接受團隊模式設定", () => {
    const teamGame = {
      title: "團隊遊戲",
      gameMode: "team",
      minTeamPlayers: 3,
      maxTeamPlayers: 8,
      enableTeamChat: true,
      enableTeamLocation: true,
      teamScoreMode: "shared",
    };

    const result = insertGameSchema.safeParse(teamGame);
    expect(result.success).toBe(true);
  });

  it("接受地點鎖定設定", () => {
    const lockedGame = {
      title: "定點遊戲",
      locationLockEnabled: true,
      lockLatitude: "24.44909700",
      lockLongitude: "118.37675500",
      lockRadius: 100,
      lockLocationName: "金門國家公園",
    };

    const result = insertGameSchema.safeParse(lockedGame);
    expect(result.success).toBe(true);
  });
});

describe("insertPageSchema", () => {
  it("接受有效的頁面資料", () => {
    const validPage = {
      gameId: "game-123",
      pageOrder: 1,
      pageType: "text_card",
      config: {
        title: "歡迎",
        content: "歡迎來到遊戲",
      },
    };

    const result = insertPageSchema.safeParse(validPage);
    expect(result.success).toBe(true);
  });

  it("拒絕缺少必要欄位的頁面", () => {
    const missingFields = {
      gameId: "game-123",
    };

    const result = insertPageSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });

  it("接受不同頁面類型", () => {
    const pageTypes = [
      "text_card",
      "dialogue",
      "video",
      "button",
      "text_verify",
      "qr_scan",
      "gps_mission",
      "photo_mission",
    ];

    for (const pageType of pageTypes) {
      const result = insertPageSchema.safeParse({
        gameId: "game-123",
        pageOrder: 1,
        pageType,
        config: {},
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("insertItemSchema", () => {
  it("接受有效的道具資料", () => {
    const validItem = {
      gameId: "game-123",
      name: "金鑰匙",
      description: "開啟神秘大門的鑰匙",
      itemType: "quest_item",
    };

    const result = insertItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("拒絕沒有 name 的道具", () => {
    const noName = {
      gameId: "game-123",
      description: "缺少名稱的道具",
    };

    const result = insertItemSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it("拒絕沒有 gameId 的道具", () => {
    const noGameId = {
      name: "測試道具",
    };

    const result = insertItemSchema.safeParse(noGameId);
    expect(result.success).toBe(false);
  });
});

describe("insertEventSchema", () => {
  it("接受有效的事件資料", () => {
    const validEvent = {
      gameId: "game-123",
      name: "QR Code 觸發",
      eventType: "qrcode",
      triggerConfig: { code: "ABC123" },
    };

    const result = insertEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("拒絕缺少必要欄位的事件", () => {
    const missingFields = {
      gameId: "game-123",
      name: "不完整事件",
    };

    const result = insertEventSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });
});
