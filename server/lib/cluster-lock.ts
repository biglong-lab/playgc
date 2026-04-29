// 🔒 Cluster Lock — 跨多個 container / process 確保 scheduler 任務只跑一份
//
// 用 PostgreSQL advisory lock（pg_try_advisory_lock）：
//   - 跨 connection 唯一（即使是不同 container 也能正確互斥）
//   - 鎖綁定 transaction 或 session（pg_try_advisory_xact_lock 自動釋放）
//   - 失敗不阻塞，立即回 false（其他 instance 已搶到 = skip）
//
// 用法：
//   await withClusterLock('lifecycle-scheduler', async () => {
//     // 真正的工作（只會有一個 container 執行）
//   });
//
// 為何不用 Redis：避免引入新依賴；Postgres 已是必要組件
// 為何不用記憶體鎖：水平擴展時失效

import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * 把字串 key 轉成 64-bit 整數（advisory lock 需要 bigint key）
 * 用簡單 hash（djb2 變形），collision 機率低且穩定
 */
function hashKey(key: string): bigint {
  const FIVE = BigInt(5);
  const MASK = BigInt("0xffffffffffffffff");
  const SIGNED_MAX = BigInt("0x7fffffffffffffff");
  const TWO_POW_64 = BigInt("0x10000000000000000");

  let hash = BigInt(5381);
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << FIVE) + hash + BigInt(key.charCodeAt(i))) & MASK;
  }
  // PostgreSQL bigint 是有號 64-bit，要轉成 -2^63 到 2^63-1 範圍
  if (hash > SIGNED_MAX) hash -= TWO_POW_64;
  return hash;
}

/**
 * 嘗試用 advisory lock 互斥執行任務
 * @param key 鎖名稱（同 key 的呼叫互斥）
 * @param fn 任務函式
 * @returns 任務回傳值（取得鎖才執行），若沒拿到鎖則回 null
 */
export async function withClusterLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const lockId = hashKey(key);

  try {
    // pg_try_advisory_lock — session 級鎖，必須手動釋放
    const result = await db.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_lock(${lockId.toString()}::bigint) AS acquired`,
    );
    const acquired = (result.rows[0] as any)?.acquired === true;

    if (!acquired) {
      // 其他 instance 已拿到鎖，跳過
      return null;
    }

    try {
      return await fn();
    } finally {
      // 釋放鎖
      await db.execute(
        sql`SELECT pg_advisory_unlock(${lockId.toString()}::bigint)`,
      );
    }
  } catch (error) {
    console.error(`[cluster-lock] ${key} 執行失敗:`, error);
    return null;
  }
}
