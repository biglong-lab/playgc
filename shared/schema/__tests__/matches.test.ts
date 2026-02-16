/**
 * 對戰系統 Schema 測試 — matches.ts 的型別、Zod 驗證、常數
 */
import { describe, it, expect } from "vitest";
import {
  matchStatusEnum,
  scoringModeEnum,
  handoffMethodEnum,
  matchSettingsSchema,
  relayConfigSchema,
  insertGameMatchSchema,
  insertMatchParticipantSchema,
  gameModeEnum,
} from "@shared/schema";

describe("對戰系統 Schema", () => {
  describe("Enum 常數", () => {
    it("matchStatusEnum 包含所有對戰狀態", () => {
      expect(matchStatusEnum).toContain("waiting");
      expect(matchStatusEnum).toContain("countdown");
      expect(matchStatusEnum).toContain("playing");
      expect(matchStatusEnum).toContain("finished");
      expect(matchStatusEnum).toContain("cancelled");
      expect(matchStatusEnum).toHaveLength(5);
    });

    it("scoringModeEnum 包含所有計分模式", () => {
      expect(scoringModeEnum).toContain("speed");
      expect(scoringModeEnum).toContain("accuracy");
      expect(scoringModeEnum).toContain("combined");
      expect(scoringModeEnum).toHaveLength(3);
    });

    it("handoffMethodEnum 包含所有傳棒方式", () => {
      expect(handoffMethodEnum).toContain("manual");
      expect(handoffMethodEnum).toContain("auto_on_complete");
      expect(handoffMethodEnum).toContain("timed");
      expect(handoffMethodEnum).toHaveLength(3);
    });

    it("gameModeEnum 包含 competitive 和 relay", () => {
      expect(gameModeEnum).toContain("competitive");
      expect(gameModeEnum).toContain("relay");
      expect(gameModeEnum).toContain("individual");
      expect(gameModeEnum).toContain("team");
      expect(gameModeEnum).toHaveLength(4);
    });
  });

  describe("matchSettingsSchema Zod 驗證", () => {
    it("有效的完整設定通過驗證", () => {
      const result = matchSettingsSchema.safeParse({
        timeLimit: 300,
        scoringMode: "speed",
        showRealTimeRanking: true,
        maxParticipants: 20,
        countdownSeconds: 5,
      });
      expect(result.success).toBe(true);
    });

    it("最小設定通過驗證（使用預設值）", () => {
      const result = matchSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scoringMode).toBe("combined");
        expect(result.data.showRealTimeRanking).toBe(true);
      }
    });

    it("timeLimit 必須為正整數", () => {
      const result = matchSettingsSchema.safeParse({ timeLimit: -10 });
      expect(result.success).toBe(false);
    });

    it("scoringMode 不接受無效值", () => {
      const result = matchSettingsSchema.safeParse({ scoringMode: "invalid" });
      expect(result.success).toBe(false);
    });

    it("countdownSeconds 最大 30", () => {
      const result = matchSettingsSchema.safeParse({ countdownSeconds: 31 });
      expect(result.success).toBe(false);
    });

    it("countdownSeconds 可以為 0", () => {
      const result = matchSettingsSchema.safeParse({ countdownSeconds: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe("relayConfigSchema Zod 驗證", () => {
    it("有效的接力設定通過驗證", () => {
      const result = relayConfigSchema.safeParse({
        segmentCount: 4,
        handoffMethod: "auto_on_complete",
        segmentTimeLimit: 120,
        allowBacktrack: false,
      });
      expect(result.success).toBe(true);
    });

    it("segmentCount 必須為正整數", () => {
      const result = relayConfigSchema.safeParse({
        segmentCount: 0,
        handoffMethod: "manual",
      });
      expect(result.success).toBe(false);
    });

    it("handoffMethod 預設為 auto_on_complete", () => {
      const result = relayConfigSchema.safeParse({
        segmentCount: 3,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.handoffMethod).toBe("auto_on_complete");
      }
    });

    it("allowBacktrack 預設為 false", () => {
      const result = relayConfigSchema.safeParse({
        segmentCount: 2,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowBacktrack).toBe(false);
      }
    });
  });

  describe("insertGameMatchSchema", () => {
    it("有效的對戰插入資料通過驗證", () => {
      const result = insertGameMatchSchema.safeParse({
        gameId: "game-1",
        creatorId: "user-1",
        matchMode: "competitive",
        status: "waiting",
        maxTeams: 10,
        accessCode: "ABC123",
      });
      expect(result.success).toBe(true);
    });

    it("gameId 為必填", () => {
      const result = insertGameMatchSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("insertMatchParticipantSchema", () => {
    it("有效的參與者插入資料通過驗證", () => {
      const result = insertMatchParticipantSchema.safeParse({
        matchId: "match-1",
        userId: "user-1",
        currentScore: 0,
      });
      expect(result.success).toBe(true);
    });

    it("matchId 為必填", () => {
      const result = insertMatchParticipantSchema.safeParse({
        userId: "user-1",
      });
      expect(result.success).toBe(false);
    });
  });
});
