// 章節相關的資料庫儲存方法
import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameChapters,
  playerChapterProgress,
  pages,
  games,
  type GameChapter,
  type InsertGameChapter,
  type PlayerChapterProgress,
  type InsertPlayerChapterProgress,
  type GameChapterWithPages,
  type GameWithChapters,
} from "@shared/schema";

/** 章節儲存方法集合 */
export const chapterStorageMethods = {
  // ===== 章節 CRUD =====

  /** 取得遊戲的所有章節（依排序） */
  async getChapters(gameId: string): Promise<GameChapter[]> {
    return db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.gameId, gameId))
      .orderBy(asc(gameChapters.chapterOrder));
  },

  /** 取得單一章節 */
  async getChapter(id: string): Promise<GameChapter | undefined> {
    const [chapter] = await db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.id, id));
    return chapter;
  },

  /** 取得章節含所屬頁面 */
  async getChapterWithPages(
    id: string
  ): Promise<GameChapterWithPages | undefined> {
    const [chapter] = await db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.id, id));
    if (!chapter) return undefined;

    const chapterPages = await db
      .select()
      .from(pages)
      .where(eq(pages.chapterId, id))
      .orderBy(asc(pages.pageOrder));

    return { ...chapter, pages: chapterPages };
  },

  /** 建立章節 */
  async createChapter(data: InsertGameChapter): Promise<GameChapter> {
    const [chapter] = await db
      .insert(gameChapters)
      .values(data)
      .returning();
    return chapter;
  },

  /** 更新章節 */
  async updateChapter(
    id: string,
    data: Partial<InsertGameChapter>
  ): Promise<GameChapter | undefined> {
    const [updated] = await db
      .update(gameChapters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(gameChapters.id, id))
      .returning();
    return updated;
  },

  /** 刪除章節 */
  async deleteChapter(id: string): Promise<void> {
    await db.delete(gameChapters).where(eq(gameChapters.id, id));
  },

  /** 重新排序章節 */
  async reorderChapters(
    gameId: string,
    chapterIds: string[]
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < chapterIds.length; i++) {
        await tx
          .update(gameChapters)
          .set({ chapterOrder: i + 1, updatedAt: new Date() })
          .where(
            and(
              eq(gameChapters.id, chapterIds[i]),
              eq(gameChapters.gameId, gameId)
            )
          );
      }
    });
  },

  /** 取得遊戲含所有章節和頁面 */
  async getGameWithChapters(
    gameId: string
  ): Promise<GameWithChapters | undefined> {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) return undefined;

    const chapters = await db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.gameId, gameId))
      .orderBy(asc(gameChapters.chapterOrder));

    const chaptersWithPages: GameChapterWithPages[] = await Promise.all(
      chapters.map(async (chapter) => {
        const chapterPages = await db
          .select()
          .from(pages)
          .where(eq(pages.chapterId, chapter.id))
          .orderBy(asc(pages.pageOrder));
        return { ...chapter, pages: chapterPages };
      })
    );

    return { ...game, chapters: chaptersWithPages };
  },

  // ===== 玩家章節進度 =====

  /** 取得玩家在遊戲中的所有章節進度 */
  async getPlayerChapterProgress(
    userId: string,
    gameId: string
  ): Promise<PlayerChapterProgress[]> {
    return db
      .select()
      .from(playerChapterProgress)
      .where(
        and(
          eq(playerChapterProgress.userId, userId),
          eq(playerChapterProgress.gameId, gameId)
        )
      );
  },

  /** 取得玩家在特定章節的進度 */
  async getChapterProgressByChapter(
    userId: string,
    chapterId: string
  ): Promise<PlayerChapterProgress | undefined> {
    const [progress] = await db
      .select()
      .from(playerChapterProgress)
      .where(
        and(
          eq(playerChapterProgress.userId, userId),
          eq(playerChapterProgress.chapterId, chapterId)
        )
      );
    return progress;
  },

  /** 建立章節進度記錄 */
  async createChapterProgress(
    data: InsertPlayerChapterProgress
  ): Promise<PlayerChapterProgress> {
    const [progress] = await db
      .insert(playerChapterProgress)
      .values(data)
      .returning();
    return progress;
  },

  /** 更新章節進度 */
  async updateChapterProgress(
    id: string,
    data: Partial<InsertPlayerChapterProgress>
  ): Promise<PlayerChapterProgress | undefined> {
    const [updated] = await db
      .update(playerChapterProgress)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playerChapterProgress.id, id))
      .returning();
    return updated;
  },

  /** 檢查章節是否已解鎖 */
  async isChapterUnlocked(
    userId: string,
    chapterId: string
  ): Promise<boolean> {
    const [chapter] = await db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.id, chapterId));
    if (!chapter) return false;

    // free 類型章節永遠解鎖
    if (chapter.unlockType === "free") return true;

    const [progress] = await db
      .select()
      .from(playerChapterProgress)
      .where(
        and(
          eq(playerChapterProgress.userId, userId),
          eq(playerChapterProgress.chapterId, chapterId)
        )
      );

    if (!progress) {
      // 第一章預設解鎖
      if (chapter.chapterOrder === 1) return true;
      return false;
    }

    return progress.status !== "locked";
  },

  /** 完成章節後解鎖下一章 */
  async unlockNextChapter(
    userId: string,
    gameId: string,
    completedChapterId: string
  ): Promise<PlayerChapterProgress | null> {
    // 取得已完成章節的排序
    const [completed] = await db
      .select()
      .from(gameChapters)
      .where(eq(gameChapters.id, completedChapterId));
    if (!completed) return null;

    // 取得遊戲的解鎖模式
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));
    if (!game) return null;

    // 找到下一章
    const [nextChapter] = await db
      .select()
      .from(gameChapters)
      .where(
        and(
          eq(gameChapters.gameId, gameId),
          eq(gameChapters.chapterOrder, completed.chapterOrder + 1)
        )
      );
    if (!nextChapter) return null;

    // 檢查是否已有進度記錄
    const [existing] = await db
      .select()
      .from(playerChapterProgress)
      .where(
        and(
          eq(playerChapterProgress.userId, userId),
          eq(playerChapterProgress.chapterId, nextChapter.id)
        )
      );

    if (existing) {
      // 已解鎖則不重複更新
      if (existing.status !== "locked") return existing;
      const [updated] = await db
        .update(playerChapterProgress)
        .set({ status: "unlocked", updatedAt: new Date() })
        .where(eq(playerChapterProgress.id, existing.id))
        .returning();
      return updated;
    }

    // 建立新的解鎖進度
    const [newProgress] = await db
      .insert(playerChapterProgress)
      .values({
        userId,
        gameId,
        chapterId: nextChapter.id,
        status: "unlocked",
      })
      .returning();
    return newProgress;
  },
};
