// 購買/票券相關的資料庫儲存方法
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  redeemCodes,
  redeemCodeUses,
  purchases,
  paymentTransactions,
  type RedeemCode,
  type InsertRedeemCode,
  type RedeemCodeUse,
  type InsertRedeemCodeUse,
  type Purchase,
  type InsertPurchase,
  type PaymentTransaction,
  type InsertPaymentTransaction,
} from "@shared/schema";

/** 購買/票券儲存方法集合 */
export const purchaseStorageMethods = {
  // ===== 兌換碼 CRUD =====

  /** 取得遊戲的所有兌換碼 */
  async getRedeemCodes(gameId: string): Promise<RedeemCode[]> {
    return db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.gameId, gameId))
      .orderBy(desc(redeemCodes.createdAt));
  },

  /** 依碼查詢兌換碼 */
  async getRedeemCodeByCode(code: string): Promise<RedeemCode | undefined> {
    const [result] = await db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.code, code.toUpperCase()));
    return result;
  },

  /** 依 ID 查詢兌換碼 */
  async getRedeemCode(id: string): Promise<RedeemCode | undefined> {
    const [result] = await db
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.id, id));
    return result;
  },

  /** 建立單一兌換碼 */
  async createRedeemCode(data: InsertRedeemCode): Promise<RedeemCode> {
    const [result] = await db.insert(redeemCodes).values(data).returning();
    return result;
  },

  /** 批次建立兌換碼 */
  async createRedeemCodes(data: InsertRedeemCode[]): Promise<RedeemCode[]> {
    if (data.length === 0) return [];
    return db.insert(redeemCodes).values(data).returning();
  },

  /** 更新兌換碼 */
  async updateRedeemCode(
    id: string,
    data: Partial<InsertRedeemCode>
  ): Promise<RedeemCode | undefined> {
    const [result] = await db
      .update(redeemCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(redeemCodes.id, id))
      .returning();
    return result;
  },

  /** 刪除兌換碼 */
  async deleteRedeemCode(id: string): Promise<void> {
    await db.delete(redeemCodes).where(eq(redeemCodes.id, id));
  },

  /** 遞增兌換碼使用次數（原子操作） */
  async incrementRedeemCodeUsage(id: string): Promise<void> {
    await db
      .update(redeemCodes)
      .set({
        usedCount: sql`${redeemCodes.usedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(redeemCodes.id, id));
  },

  // ===== 兌換碼使用紀錄 =====

  /** 取得兌換碼的使用紀錄 */
  async getCodeUses(codeId: string): Promise<RedeemCodeUse[]> {
    return db
      .select()
      .from(redeemCodeUses)
      .where(eq(redeemCodeUses.codeId, codeId))
      .orderBy(desc(redeemCodeUses.redeemedAt));
  },

  /** 檢查使用者是否已兌換過此碼 */
  async hasUserRedeemedCode(
    codeId: string,
    userId: string
  ): Promise<boolean> {
    const [result] = await db
      .select()
      .from(redeemCodeUses)
      .where(
        and(
          eq(redeemCodeUses.codeId, codeId),
          eq(redeemCodeUses.userId, userId)
        )
      );
    return !!result;
  },

  /** 記錄兌換碼使用 */
  async createCodeUse(data: InsertRedeemCodeUse): Promise<RedeemCodeUse> {
    const [result] = await db
      .insert(redeemCodeUses)
      .values(data)
      .returning();
    return result;
  },

  // ===== 購買記錄 =====

  /** 取得使用者的所有購買記錄 */
  async getPurchasesByUser(userId: string): Promise<Purchase[]> {
    return db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt));
  },

  /** 取得遊戲的所有購買記錄 */
  async getPurchasesByGame(gameId: string): Promise<Purchase[]> {
    return db
      .select()
      .from(purchases)
      .where(eq(purchases.gameId, gameId))
      .orderBy(desc(purchases.createdAt));
  },

  /** 查詢使用者是否已購買遊戲（整個遊戲） */
  async getUserGamePurchase(
    userId: string,
    gameId: string
  ): Promise<Purchase | undefined> {
    const [result] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.gameId, gameId),
          eq(purchases.status, "completed"),
          sql`${purchases.chapterId} IS NULL`
        )
      );
    return result;
  },

  /** 查詢使用者是否已購買特定章節 */
  async getUserChapterPurchase(
    userId: string,
    chapterId: string
  ): Promise<Purchase | undefined> {
    const [result] = await db
      .select()
      .from(purchases)
      .where(
        and(
          eq(purchases.userId, userId),
          eq(purchases.chapterId, chapterId),
          eq(purchases.status, "completed")
        )
      );
    return result;
  },

  /** 查詢單一購買記錄 */
  async getPurchase(id: string): Promise<Purchase | undefined> {
    const [result] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, id));
    return result;
  },

  /** 建立購買記錄 */
  async createPurchase(data: InsertPurchase): Promise<Purchase> {
    const [result] = await db.insert(purchases).values(data).returning();
    return result;
  },

  /** 更新購買記錄 */
  async updatePurchase(
    id: string,
    data: Partial<InsertPurchase>
  ): Promise<Purchase | undefined> {
    const [result] = await db
      .update(purchases)
      .set(data)
      .where(eq(purchases.id, id))
      .returning();
    return result;
  },

  // ===== 金流交易（Phase B） =====

  /** 查詢交易 */
  async getTransaction(
    id: string
  ): Promise<PaymentTransaction | undefined> {
    const [result] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id));
    return result;
  },

  /** 依 Recur Session ID 查詢交易 */
  async getTransactionByRecurSession(
    sessionId: string
  ): Promise<PaymentTransaction | undefined> {
    const [result] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.recurCheckoutSessionId, sessionId));
    return result;
  },

  /** 建立交易 */
  async createTransaction(
    data: InsertPaymentTransaction
  ): Promise<PaymentTransaction> {
    const [result] = await db
      .insert(paymentTransactions)
      .values(data)
      .returning();
    return result;
  },

  /** 更新交易 */
  async updateTransaction(
    id: string,
    data: Partial<InsertPaymentTransaction>
  ): Promise<PaymentTransaction | undefined> {
    const [result] = await db
      .update(paymentTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paymentTransactions.id, id))
      .returning();
    return result;
  },
};
