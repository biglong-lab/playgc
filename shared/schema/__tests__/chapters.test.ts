import { describe, it, expect } from "vitest";
import {
  insertGameChapterSchema,
  insertPlayerChapterProgressSchema,
  chapterUnlockTypeEnum,
  chapterStatusEnum,
  chapterProgressStatusEnum,
} from "../chapters";

describe("insertGameChapterSchema", () => {
  it("接受有效的章節資料", () => {
    const valid = {
      gameId: "game-123",
      chapterOrder: 1,
      title: "第一章：冒險開始",
    };
    const result = insertGameChapterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("接受完整章節資料", () => {
    const full = {
      gameId: "game-123",
      chapterOrder: 2,
      title: "第二章",
      description: "深入探索",
      coverImageUrl: "https://example.com/cover.jpg",
      unlockType: "score_threshold",
      unlockConfig: { requiredScore: 80 },
      estimatedTime: 45,
      status: "published",
    };
    const result = insertGameChapterSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("拒絕缺少 title 的資料", () => {
    const noTitle = { gameId: "game-123", chapterOrder: 1 };
    const result = insertGameChapterSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("拒絕缺少 gameId 的資料", () => {
    const noGameId = { chapterOrder: 1, title: "Test" };
    const result = insertGameChapterSchema.safeParse(noGameId);
    expect(result.success).toBe(false);
  });

  it("拒絕缺少 chapterOrder 的資料", () => {
    const noOrder = { gameId: "game-123", title: "Test" };
    const result = insertGameChapterSchema.safeParse(noOrder);
    expect(result.success).toBe(false);
  });
});

describe("insertPlayerChapterProgressSchema", () => {
  it("接受有效的進度資料", () => {
    const valid = {
      userId: "user-123",
      gameId: "game-123",
      chapterId: "chapter-123",
    };
    const result = insertPlayerChapterProgressSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("接受完整進度資料", () => {
    const full = {
      userId: "user-123",
      gameId: "game-123",
      chapterId: "chapter-123",
      status: "in_progress",
      bestScore: 95,
      chapterVariables: { key: "value" },
    };
    const result = insertPlayerChapterProgressSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("拒絕缺少必要欄位的資料", () => {
    const incomplete = { userId: "user-123" };
    const result = insertPlayerChapterProgressSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe("章節列舉值", () => {
  it("unlockType 包含正確的值", () => {
    expect(chapterUnlockTypeEnum).toContain("free");
    expect(chapterUnlockTypeEnum).toContain("complete_previous");
    expect(chapterUnlockTypeEnum).toContain("score_threshold");
    expect(chapterUnlockTypeEnum).toContain("paid");
    expect(chapterUnlockTypeEnum).toHaveLength(4);
  });

  it("chapterStatus 包含正確的值", () => {
    expect(chapterStatusEnum).toContain("draft");
    expect(chapterStatusEnum).toContain("published");
    expect(chapterStatusEnum).toContain("hidden");
    expect(chapterStatusEnum).toHaveLength(3);
  });

  it("chapterProgressStatus 包含正確的值", () => {
    expect(chapterProgressStatusEnum).toContain("locked");
    expect(chapterProgressStatusEnum).toContain("unlocked");
    expect(chapterProgressStatusEnum).toContain("in_progress");
    expect(chapterProgressStatusEnum).toContain("completed");
    expect(chapterProgressStatusEnum).toHaveLength(4);
  });
});
