// 🎯 ShootingTeam broadcast 增強 helper
//
// 用途：在 server 廣播 shooting_hit 訊息前，把 record 補上 displayName，
// 讓 client（ShootingTeam 元件）能在排行榜顯示誰打的命中。
//
// 兩個 broadcast path 都呼叫此 helper：
//   1. server/routes/devices.ts POST /api/shooting-records
//   2. server/mqttService.ts handleHitMessage（Arduino MQTT 推來的）
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.3 + Phase A2

import { storage } from "../storage";

/**
 * 從 user 物件推導顯示名（fallback 鏈：firstName+lastName / email / userId）
 */
function deriveDisplayName(user: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.email) return user.email.split("@")[0];
  return user.id.slice(0, 8);
}

/**
 * 給 record 補上 displayName 欄位，供 broadcast 後 ShootingTeam 排行榜使用。
 *
 * - 如果 record 已有 displayName → 直接回傳
 * - 如果 record 有 userId → 從 storage 反查 user
 * - 如果都沒有 → displayName 設 null（client 端會 fallback 到「未知」）
 *
 * @param record 來自 createShootingRecord 的 ShootingRecord 物件
 * @returns 補上 displayName 的擴充 record
 */
export async function enrichShootingRecordForBroadcast<T extends { userId?: string | null }>(
  record: T,
): Promise<T & { displayName: string | null }> {
  // 已有 displayName 不重複查
  if ("displayName" in record && typeof record.displayName === "string") {
    return record as T & { displayName: string | null };
  }

  let displayName: string | null = null;
  if (record.userId) {
    try {
      const user = await storage.getUser(record.userId);
      if (user) {
        displayName = deriveDisplayName(user);
      }
    } catch {
      // 反查失敗 → 不阻塞 broadcast，displayName 留 null
    }
  }

  return { ...record, displayName };
}
