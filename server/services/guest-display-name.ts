// 🏷️ 訪客暱稱寫入 users.firstName（自 routes/teams.ts 抽出，2026-09-22）
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";

/**
 * 🐛 修 bug（ProPlan CHITO #7）：訪客暱稱只存 localStorage / gameSessions.playerName，
 *   沒進 users 表 → 多人隊伍成員列表（讀 users.firstName）顯示 user-xxx@firebase.local。
 *   修法：訪客建立/加入隊伍時把暱稱寫進自己的 users.firstName。
 *   僅限匿名訪客才覆寫，避免蓋掉正式帳號真名。
 *   🐛 2026-09-22 審查：改看 token 的 signInProvider=anonymous —— LINE（custom token）帳號
 *   在 DB 也是 *@firebase.local 假信箱，只看信箱會把 LINE 真名蓋成「探險家xxxx」。
 */
export async function persistGuestDisplayName(
  userId: string,
  rawName: string | undefined,
  signInProvider: string | undefined,
): Promise<void> {
  const name = rawName?.trim();
  if (!name || signInProvider !== "anonymous") return;
  const user = await storage.getUser(userId);
  if (!user || !user.email?.endsWith("@firebase.local")) return;
  const clean = name.slice(0, 50);
  if (user.firstName === clean) return;
  await db.update(users).set({ firstName: clean, updatedAt: new Date() }).where(eq(users.id, userId));
}
