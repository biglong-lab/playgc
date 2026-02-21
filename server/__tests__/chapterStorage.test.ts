// 章節 Storage 層單元測試（mock Drizzle DB）
import { describe, it, expect, vi, beforeEach } from "vitest";

// 建立 mock 鏈式查詢
function createMockQuery(result: any = []) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
    // 支援 for await / async iteration
    [Symbol.asyncIterator]: async function* () {
      for (const item of result) yield item;
    },
  };
  return chain;
}

// Mock db 模組
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
    transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

// Mock schema 表定義（drizzle 需要）
vi.mock("@shared/schema", () => ({
  gameChapters: { id: "id", gameId: "gameId", chapterOrder: "chapterOrder" },
  playerChapterProgress: {
    id: "id",
    userId: "userId",
    gameId: "gameId",
    chapterId: "chapterId",
    status: "status",
  },
  pages: { id: "id", chapterId: "chapterId", pageOrder: "pageOrder" },
  games: { id: "id" },
}));

import { chapterStorageMethods } from "../storage/chapter-storage";

// 測試用資料工廠
function makeChapter(overrides = {}) {
  return {
    id: "ch-1",
    gameId: "game-1",
    title: "第一章",
    description: "測試章節",
    chapterOrder: 1,
    unlockType: "sequential",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProgress(overrides = {}) {
  return {
    id: "prog-1",
    userId: "user-1",
    gameId: "game-1",
    chapterId: "ch-1",
    status: "in_progress",
    bestScore: 0,
    completedAt: null,
    lastPlayedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("chapterStorageMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================================================================
  // 章節 CRUD
  // ======================================================================
  describe("getChapters", () => {
    it("回傳指定遊戲的章節列表", async () => {
      const chapters = [makeChapter(), makeChapter({ id: "ch-2", chapterOrder: 2 })];
      mockSelect.mockReturnValue(createMockQuery(chapters));

      const result = await chapterStorageMethods.getChapters("game-1");

      expect(result).toEqual(chapters);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("無章節回傳空陣列", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.getChapters("game-1");

      expect(result).toEqual([]);
    });
  });

  describe("getChapter", () => {
    it("回傳單一章節", async () => {
      const chapter = makeChapter();
      mockSelect.mockReturnValue(createMockQuery([chapter]));

      const result = await chapterStorageMethods.getChapter("ch-1");

      expect(result).toEqual(chapter);
    });

    it("不存在回傳 undefined", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.getChapter("not-exist");

      expect(result).toBeUndefined();
    });
  });

  describe("getChapterWithPages", () => {
    it("回傳章節含頁面", async () => {
      const chapter = makeChapter();
      const chapterPages = [
        { id: "page-1", title: "頁面1", chapterId: "ch-1", pageOrder: 1 },
        { id: "page-2", title: "頁面2", chapterId: "ch-1", pageOrder: 2 },
      ];

      // 第一次 select 回傳章節，第二次回傳頁面
      mockSelect
        .mockReturnValueOnce(createMockQuery([chapter]))
        .mockReturnValueOnce(createMockQuery(chapterPages));

      const result = await chapterStorageMethods.getChapterWithPages("ch-1");

      expect(result).toBeDefined();
      expect(result!.pages).toHaveLength(2);
      expect(result!.title).toBe("第一章");
    });

    it("章節不存在回傳 undefined", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.getChapterWithPages("not-exist");

      expect(result).toBeUndefined();
    });
  });

  describe("createChapter", () => {
    it("建立新章節", async () => {
      const newChapter = makeChapter();
      mockInsert.mockReturnValue(createMockQuery([newChapter]));

      const result = await chapterStorageMethods.createChapter({
        gameId: "game-1",
        title: "第一章",
        chapterOrder: 1,
      } as any);

      expect(result).toEqual(newChapter);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("updateChapter", () => {
    it("更新章節並回傳", async () => {
      const updated = makeChapter({ title: "新標題" });
      mockUpdate.mockReturnValue(createMockQuery([updated]));

      const result = await chapterStorageMethods.updateChapter("ch-1", {
        title: "新標題",
      });

      expect(result).toEqual(updated);
      expect(result!.title).toBe("新標題");
    });

    it("更新不存在的章節回傳 undefined", async () => {
      mockUpdate.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.updateChapter("not-exist", {
        title: "test",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("deleteChapter", () => {
    it("刪除章節", async () => {
      const chain = createMockQuery();
      mockDelete.mockReturnValue(chain);

      await chapterStorageMethods.deleteChapter("ch-1");

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("reorderChapters", () => {
    it("批次更新章節排序", async () => {
      const txUpdate = vi.fn(() => createMockQuery());
      const mockTx = { update: txUpdate };

      mockTransaction.mockImplementation(async (fn: any) => {
        await fn(mockTx);
      });

      await chapterStorageMethods.reorderChapters("game-1", ["ch-2", "ch-1", "ch-3"]);

      expect(mockTransaction).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalledTimes(3);
    });

    it("空陣列不執行更新", async () => {
      const txUpdate = vi.fn();
      const mockTx = { update: txUpdate };

      mockTransaction.mockImplementation(async (fn: any) => {
        await fn(mockTx);
      });

      await chapterStorageMethods.reorderChapters("game-1", []);

      expect(mockTransaction).toHaveBeenCalled();
      expect(txUpdate).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // 玩家章節進度
  // ======================================================================
  describe("getPlayerChapterProgress", () => {
    it("回傳玩家在遊戲中的所有章節進度", async () => {
      const progresses = [
        makeProgress({ chapterId: "ch-1", status: "completed" }),
        makeProgress({ id: "prog-2", chapterId: "ch-2", status: "in_progress" }),
      ];
      mockSelect.mockReturnValue(createMockQuery(progresses));

      const result = await chapterStorageMethods.getPlayerChapterProgress(
        "user-1",
        "game-1"
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("getChapterProgressByChapter", () => {
    it("回傳特定章節進度", async () => {
      const progress = makeProgress();
      mockSelect.mockReturnValue(createMockQuery([progress]));

      const result = await chapterStorageMethods.getChapterProgressByChapter(
        "user-1",
        "ch-1"
      );

      expect(result).toEqual(progress);
    });

    it("無進度回傳 undefined", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.getChapterProgressByChapter(
        "user-1",
        "ch-999"
      );

      expect(result).toBeUndefined();
    });
  });

  describe("createChapterProgress", () => {
    it("建立新進度記錄", async () => {
      const progress = makeProgress();
      mockInsert.mockReturnValue(createMockQuery([progress]));

      const result = await chapterStorageMethods.createChapterProgress({
        userId: "user-1",
        gameId: "game-1",
        chapterId: "ch-1",
        status: "in_progress",
      } as any);

      expect(result).toEqual(progress);
    });
  });

  describe("updateChapterProgress", () => {
    it("更新進度並回傳", async () => {
      const updated = makeProgress({ status: "completed", bestScore: 95 });
      mockUpdate.mockReturnValue(createMockQuery([updated]));

      const result = await chapterStorageMethods.updateChapterProgress("prog-1", {
        status: "completed",
        bestScore: 95,
      } as any);

      expect(result).toEqual(updated);
      expect(result!.status).toBe("completed");
    });
  });

  describe("isChapterUnlocked", () => {
    it("free 類型章節永遠解鎖", async () => {
      mockSelect.mockReturnValue(
        createMockQuery([makeChapter({ unlockType: "free" })])
      );

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "ch-1");

      expect(result.unlocked).toBe(true);
    });

    it("第一章預設解鎖（無進度記錄）", async () => {
      // 第一次查章節，第二次查進度（空）
      mockSelect
        .mockReturnValueOnce(
          createMockQuery([makeChapter({ chapterOrder: 1 })])
        )
        .mockReturnValueOnce(createMockQuery([]));

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "ch-1");

      expect(result.unlocked).toBe(true);
    });

    it("非第一章且無進度 → 未解鎖", async () => {
      mockSelect
        .mockReturnValueOnce(
          createMockQuery([makeChapter({ chapterOrder: 2 })])
        )
        .mockReturnValueOnce(createMockQuery([]));

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "ch-2");

      expect(result.unlocked).toBe(false);
    });

    it("有進度且非 locked → 已解鎖", async () => {
      mockSelect
        .mockReturnValueOnce(
          createMockQuery([makeChapter({ chapterOrder: 2 })])
        )
        .mockReturnValueOnce(
          createMockQuery([makeProgress({ status: "unlocked" })])
        );

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "ch-2");

      expect(result.unlocked).toBe(true);
    });

    it("有進度但 locked → 未解鎖", async () => {
      mockSelect
        .mockReturnValueOnce(
          createMockQuery([makeChapter({ chapterOrder: 2 })])
        )
        .mockReturnValueOnce(
          createMockQuery([makeProgress({ status: "locked" })])
        );

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "ch-2");

      expect(result.unlocked).toBe(false);
    });

    it("章節不存在 → false", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.isChapterUnlocked("user-1", "not-exist");

      expect(result.unlocked).toBe(false);
    });
  });

  describe("unlockNextChapter", () => {
    it("找不到已完成章節 → null", async () => {
      mockSelect.mockReturnValue(createMockQuery([]));

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-1",
        "ch-999"
      );

      expect(result).toBeNull();
    });

    it("找不到遊戲 → null", async () => {
      mockSelect
        .mockReturnValueOnce(createMockQuery([makeChapter()]))
        .mockReturnValueOnce(createMockQuery([])); // 遊戲不存在

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-999",
        "ch-1"
      );

      expect(result).toBeNull();
    });

    it("無下一章 → null", async () => {
      mockSelect
        .mockReturnValueOnce(createMockQuery([makeChapter({ chapterOrder: 3 })]))
        .mockReturnValueOnce(createMockQuery([{ id: "game-1" }]))
        .mockReturnValueOnce(createMockQuery([])); // 無下一章

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-1",
        "ch-3"
      );

      expect(result).toBeNull();
    });

    it("解鎖下一章（新建進度）", async () => {
      const nextChapter = makeChapter({ id: "ch-2", chapterOrder: 2 });
      const newProgress = makeProgress({
        id: "prog-2",
        chapterId: "ch-2",
        status: "unlocked",
      });

      mockSelect
        .mockReturnValueOnce(createMockQuery([makeChapter({ chapterOrder: 1 })]))
        .mockReturnValueOnce(createMockQuery([{ id: "game-1" }]))
        .mockReturnValueOnce(createMockQuery([nextChapter]))
        .mockReturnValueOnce(createMockQuery([])); // 無既有進度

      mockInsert.mockReturnValue(createMockQuery([newProgress]));

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-1",
        "ch-1"
      );

      expect(result).toEqual(newProgress);
      expect(result!.status).toBe("unlocked");
    });

    it("下一章已有 locked 進度 → 更新為 unlocked", async () => {
      const nextChapter = makeChapter({ id: "ch-2", chapterOrder: 2 });
      const existingProgress = makeProgress({
        id: "prog-2",
        chapterId: "ch-2",
        status: "locked",
      });
      const updatedProgress = makeProgress({
        id: "prog-2",
        chapterId: "ch-2",
        status: "unlocked",
      });

      mockSelect
        .mockReturnValueOnce(createMockQuery([makeChapter({ chapterOrder: 1 })]))
        .mockReturnValueOnce(createMockQuery([{ id: "game-1" }]))
        .mockReturnValueOnce(createMockQuery([nextChapter]))
        .mockReturnValueOnce(createMockQuery([existingProgress]));

      mockUpdate.mockReturnValue(createMockQuery([updatedProgress]));

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-1",
        "ch-1"
      );

      expect(result).toEqual(updatedProgress);
    });

    it("下一章已非 locked → 不重複更新", async () => {
      const nextChapter = makeChapter({ id: "ch-2", chapterOrder: 2 });
      const existingProgress = makeProgress({
        id: "prog-2",
        chapterId: "ch-2",
        status: "unlocked",
      });

      mockSelect
        .mockReturnValueOnce(createMockQuery([makeChapter({ chapterOrder: 1 })]))
        .mockReturnValueOnce(createMockQuery([{ id: "game-1" }]))
        .mockReturnValueOnce(createMockQuery([nextChapter]))
        .mockReturnValueOnce(createMockQuery([existingProgress]));

      const result = await chapterStorageMethods.unlockNextChapter(
        "user-1",
        "game-1",
        "ch-1"
      );

      expect(result).toEqual(existingProgress);
      // 不應呼叫 update 或 insert
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
