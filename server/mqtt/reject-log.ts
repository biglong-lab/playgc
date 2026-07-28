// 🔍 MQTT 拒收診斷（ADR-0024）
//
// 收訊防線擋掉的訊息不會進 DB，管理員只看得到「命中沒進來」卻查不出原因。
// 這裡用記憶體 ring buffer 留最近 50 筆拒收紀錄供後台面板查閱：
// 刻意不落 DB —— 純診斷用途、重啟即清，避免被偽造訊息灌爆資料表。

/** 拒收原因；與 ingest.ts 的六個拒收點一一對應 */
export type RejectReason =
  | "bad_topic"
  | "bad_json"
  | "schema_mismatch"
  | "device_id_mismatch"
  | "unknown_device"
  | "hmac_failed";

export interface RejectEntry {
  at: string;
  topic: string;
  reason: RejectReason;
  deviceId?: string;
}

const MAX_ENTRIES = 50;
const buffer: RejectEntry[] = [];

/** 記一筆拒收；超過上限自動丟棄最舊一筆 */
export function recordReject(
  topic: string,
  reason: RejectReason,
  deviceId?: string,
): void {
  buffer.push({
    at: new Date().toISOString(),
    topic,
    reason,
    ...(deviceId ? { deviceId } : {}),
  });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

/** 取最近拒收紀錄（新的在前） */
export function getRecentRejects(): RejectEntry[] {
  return [...buffer].reverse();
}

/** 測試用：清空 buffer */
export function clearRejects(): void {
  buffer.length = 0;
}
