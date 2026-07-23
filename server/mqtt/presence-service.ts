// 🔌 裝置在線狀態維護（ADR-0024）
//
// 心跳由 ingest 收到 state 訊息時更新；本模組負責「逾時判定」。
// 沒有這個 sweeper，設備拔電後 DB 會永遠停在 online —— 後台統計就完全不可信。
//
// LWT（遺囑）能讓 broker 在連線異常中斷時立刻代發 offline，
// 但遇到「設備沒斷 TCP 卻死機」仍需靠此逾時掃描兜底。

import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "../db";
import { arduinoDevices } from "@shared/schema";

/** 超過此秒數沒有心跳即視為離線（ADR-0024 狀態判定） */
const OFFLINE_AFTER_MS = 90_000;
const SWEEP_INTERVAL_MS = 30_000;

let timer: NodeJS.Timeout | null = null;

/** 把逾時未回報的設備標記為離線；回傳受影響筆數 */
export async function sweepStaleDevices(): Promise<void> {
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
  try {
    await db
      .update(arduinoDevices)
      .set({ status: "offline", updatedAt: new Date() })
      .where(
        and(
          eq(arduinoDevices.status, "online"),
          isNotNull(arduinoDevices.lastHeartbeat),
          lt(arduinoDevices.lastHeartbeat, cutoff),
        ),
      );
  } catch (e) {
    console.error("[mqtt-presence] 離線掃描失敗", e);
  }
}

export function startPresenceSweeper(): void {
  if (timer) return;
  timer = setInterval(() => {
    void sweepStaleDevices();
  }, SWEEP_INTERVAL_MS);
}

export function stopPresenceSweeper(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
