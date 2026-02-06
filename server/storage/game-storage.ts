// 遊戲、頁面、道具、事件相關的資料庫儲存方法
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  games,
  pages,
  items,
  events,
  type Game,
  type InsertGame,
  type Page,
  type InsertPage,
  type Item,
  type InsertItem,
  type GameEvent,
  type InsertEvent,
  type GameWithPages,
  type GameWithDetails,
} from "@shared/schema";

/** 遊戲儲存方法集合 */
export const gameStorageMethods = {
  // ===== 遊戲 =====

  /** 取得所有遊戲（依建立時間倒序） */
  async getGames(): Promise<Game[]> {
    return db.select().from(games).orderBy(desc(games.createdAt));
  },

  /** 取得已發布的遊戲 */
  async getPublishedGames(): Promise<Game[]> {
    return db.select().from(games).where(eq(games.status, "published")).orderBy(desc(games.createdAt));
  },

  /** 根據 ID 取得遊戲 */
  async getGame(id: string): Promise<Game | undefined> {
    const result = await db.select().from(games).where(eq(games.id, id));
    return result[0];
  },

  /** 取得遊戲及其所有頁面 */
  async getGameWithPages(id: string): Promise<GameWithPages | undefined> {
    const game = await gameStorageMethods.getGame(id);
    if (!game) return undefined;

    const gamePages = await db.select().from(pages).where(eq(pages.gameId, id)).orderBy(pages.pageOrder);
    return { ...game, pages: gamePages };
  },

  /** 取得遊戲及其完整詳細資料（頁面、道具、事件） */
  async getGameWithDetails(id: string): Promise<GameWithDetails | undefined> {
    const game = await gameStorageMethods.getGame(id);
    if (!game) return undefined;

    const [gamePages, gameItems, gameEvents] = await Promise.all([
      db.select().from(pages).where(eq(pages.gameId, id)).orderBy(pages.pageOrder),
      db.select().from(items).where(eq(items.gameId, id)),
      db.select().from(events).where(eq(events.gameId, id)),
    ]);

    return { ...game, pages: gamePages, items: gameItems, events: gameEvents };
  },

  /** 建立新遊戲 */
  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  },

  /** 更新遊戲 */
  async updateGame(id: string, game: Partial<InsertGame>): Promise<Game | undefined> {
    const [updated] = await db
      .update(games)
      .set({ ...game, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    return updated;
  },

  /** 刪除遊戲 */
  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  },

  // ===== 頁面 =====

  /** 取得遊戲的所有頁面（依頁面順序排列） */
  async getPages(gameId: string): Promise<Page[]> {
    return db.select().from(pages).where(eq(pages.gameId, gameId)).orderBy(pages.pageOrder);
  },

  /** 根據 ID 取得頁面 */
  async getPage(id: string): Promise<Page | undefined> {
    const result = await db.select().from(pages).where(eq(pages.id, id));
    return result[0];
  },

  /** 建立新頁面 */
  async createPage(page: InsertPage): Promise<Page> {
    const [newPage] = await db.insert(pages).values(page).returning();
    return newPage;
  },

  /** 更新頁面 */
  async updatePage(id: string, page: Partial<InsertPage>): Promise<Page | undefined> {
    const [updated] = await db.update(pages).set(page).where(eq(pages.id, id)).returning();
    return updated;
  },

  /** 刪除頁面 */
  async deletePage(id: string): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  },

  // ===== 道具 =====

  /** 取得遊戲的所有道具 */
  async getItems(gameId: string): Promise<Item[]> {
    return db.select().from(items).where(eq(items.gameId, gameId));
  },

  /** 根據 ID 取得道具 */
  async getItem(id: string): Promise<Item | undefined> {
    const result = await db.select().from(items).where(eq(items.id, id));
    return result[0];
  },

  /** 建立新道具 */
  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db.insert(items).values(item).returning();
    return newItem;
  },

  /** 更新道具 */
  async updateItem(id: string, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items).set(item).where(eq(items.id, id)).returning();
    return updated;
  },

  /** 刪除道具 */
  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  },

  // ===== 事件 =====

  /** 取得遊戲的所有事件 */
  async getEvents(gameId: string): Promise<GameEvent[]> {
    return db.select().from(events).where(eq(events.gameId, gameId));
  },

  /** 根據 ID 取得事件 */
  async getEvent(id: string): Promise<GameEvent | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0];
  },

  /** 建立新事件 */
  async createEvent(event: InsertEvent): Promise<GameEvent> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  },

  /** 更新事件 */
  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<GameEvent | undefined> {
    const [updated] = await db.update(events).set(event).where(eq(events.id, id)).returning();
    return updated;
  },

  /** 刪除事件 */
  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  },
};
