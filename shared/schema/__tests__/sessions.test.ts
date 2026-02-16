import { describe, it, expect } from "vitest";
import {
  insertGameSessionSchema,
  insertPlayerProgressSchema,
  insertChatMessageSchema,
} from "../sessions";

describe("insertGameSessionSchema", () => {
  it("接受有效的場次資料", () => {
    const validSession = {
      gameId: "game-123",
      teamName: "勇者隊",
      playerCount: 4,
      status: "playing",
      score: 0,
    };

    const result = insertGameSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("接受最小場次資料", () => {
    const minimalSession = {};
    const result = insertGameSessionSchema.safeParse(minimalSession);
    expect(result.success).toBe(true);
  });

  it("接受不同狀態", () => {
    const statuses = ["playing", "completed", "abandoned"];

    for (const status of statuses) {
      const result = insertGameSessionSchema.safeParse({
        gameId: "game-123",
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("insertPlayerProgressSchema", () => {
  it("接受有效的進度資料", () => {
    const validProgress = {
      sessionId: "session-123",
      userId: "user-123",
      score: 100,
      inventory: ["item-1", "item-2"],
      variables: { key1: "value1" },
    };

    const result = insertPlayerProgressSchema.safeParse(validProgress);
    expect(result.success).toBe(true);
  });

  it("拒絕缺少 sessionId", () => {
    const noSessionId = {
      userId: "user-123",
    };

    const result = insertPlayerProgressSchema.safeParse(noSessionId);
    expect(result.success).toBe(false);
  });
});

describe("insertChatMessageSchema", () => {
  it("接受有效的聊天訊息", () => {
    const validMessage = {
      sessionId: "session-123",
      userId: "user-123",
      message: "大家好！",
    };

    const result = insertChatMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
  });

  it("拒絕空訊息", () => {
    const noMessage = {
      sessionId: "session-123",
      userId: "user-123",
    };

    const result = insertChatMessageSchema.safeParse(noMessage);
    expect(result.success).toBe(false);
  });

  it("接受系統訊息類型", () => {
    const systemMessage = {
      sessionId: "session-123",
      message: "玩家加入了遊戲",
      messageType: "system",
    };

    const result = insertChatMessageSchema.safeParse(systemMessage);
    expect(result.success).toBe(true);
  });
});
