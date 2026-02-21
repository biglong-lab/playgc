// 玩家章節測試共用設定 — 工廠函式、常數、型別
import { vi } from "vitest";
import express from "express";
import { storage } from "../../storage";
import { registerPlayerChapterRoutes } from "../../routes/player-chapters";

// Mock storage 型別
export type MockStorage = {
  getGame: ReturnType<typeof vi.fn>;
  getChapters: ReturnType<typeof vi.fn>;
  getChapter: ReturnType<typeof vi.fn>;
  getChapterWithPages: ReturnType<typeof vi.fn>;
  isChapterUnlocked: ReturnType<typeof vi.fn>;
  getPlayerChapterProgress: ReturnType<typeof vi.fn>;
  getChapterProgressByChapter: ReturnType<typeof vi.fn>;
  createChapterProgress: ReturnType<typeof vi.fn>;
  updateChapterProgress: ReturnType<typeof vi.fn>;
  unlockNextChapter: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
};

export const mockStorage = storage as unknown as MockStorage;

export function createTestApp() {
  const app = express();
  app.use(express.json());
  registerPlayerChapterRoutes(app);
  return app;
}

// 測試用資料工廠
export function makeChapter(overrides = {}) {
  return {
    id: "ch-1",
    gameId: "game-1",
    title: "第一章",
    description: "測試",
    chapterOrder: 1,
    unlockType: "sequential",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeProgress(overrides = {}) {
  return {
    id: "prog-1",
    userId: "player-1",
    gameId: "game-1",
    chapterId: "ch-1",
    status: "in_progress",
    bestScore: 0,
    completedAt: null,
    lastPlayedAt: null,
    ...overrides,
  };
}

export const AUTH_HEADER = { Authorization: "Bearer valid-token" };

// 重設所有 storage mock，避免測試間洩漏
export function resetStorageMocks() {
  vi.clearAllMocks();
  mockStorage.getGame.mockReset();
  mockStorage.getChapters.mockReset();
  mockStorage.getChapter.mockReset();
  mockStorage.getChapterWithPages.mockReset();
  mockStorage.isChapterUnlocked.mockReset();
  mockStorage.getPlayerChapterProgress.mockReset();
  mockStorage.getChapterProgressByChapter.mockReset();
  mockStorage.createChapterProgress.mockReset();
  mockStorage.updateChapterProgress.mockReset();
  mockStorage.unlockNextChapter.mockReset();
  mockStorage.getSession.mockReset();
}
