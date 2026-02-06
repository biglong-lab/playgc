// 使用者相關的資料庫儲存方法
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  type User,
  type UpsertUser,
} from "@shared/schema";

/** 使用者儲存方法集合 */
export const userStorageMethods = {
  /** 根據 ID 取得使用者 */
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  },

  /** 根據 Email 取得使用者 */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  },

  /** 新增或更新使用者（優先依 ID 判斷，其次依 Email） */
  async upsertUser(userData: UpsertUser): Promise<User> {
    // 優先根據 ID 查詢現有使用者（確保 Firebase UID 一致性）
    if (userData.id) {
      const existingById = await userStorageMethods.getUser(userData.id);
      if (existingById) {
        // 更新現有使用者
        const [updated] = await db
          .update(users)
          .set({
            email: userData.email || existingById.email,
            firstName: userData.firstName || existingById.firstName,
            lastName: userData.lastName || existingById.lastName,
            profileImageUrl: userData.profileImageUrl || existingById.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingById.id))
          .returning();
        return updated;
      }
    }

    // 其次嘗試根據 Email 查詢現有使用者（向後相容）
    const existingByEmail = userData.email
      ? await userStorageMethods.getUserByEmail(userData.email)
      : undefined;

    if (existingByEmail) {
      // 如果 email 已存在但 ID 不同，為新用戶生成唯一 email
      // 這種情況表示同一個 email 對應不同的 Firebase 帳號
      if (userData.id && existingByEmail.id !== userData.id) {
        // 建立新用戶，使用修改後的 email 避免衝突
        const [newUser] = await db
          .insert(users)
          .values({
            ...userData,
            email: `${userData.id}@firebase.local`,
          })
          .returning();
        return newUser;
      }

      // 更新現有使用者
      const [updated] = await db
        .update(users)
        .set({
          firstName: userData.firstName || existingByEmail.firstName,
          lastName: userData.lastName || existingByEmail.lastName,
          profileImageUrl: userData.profileImageUrl || existingByEmail.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      return updated;
    }

    // 新增使用者
    const [newUser] = await db
      .insert(users)
      .values(userData)
      .returning();
    return newUser;
  },
};
