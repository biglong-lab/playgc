// 🔄 Markov Trainer — 從歷史玩家流程訓練 transition matrix（P16-3）
//
// 用途：
//   從 player_event_logs 提取「成功玩家在 from→to 的銜接統計」
//   把結果 UPSERT 到 page_type_transitions 表
//
// 演算法（1-step Markov）：
//   1. 取近 N 天所有 page_complete 事件（成功完成路徑）
//   2. 依 (fieldId, sessionId) 分組 + createdAt 排序
//   3. 兩兩相鄰 (page[i], page[i+1]) → 累積 (fromType, toType) 計數
//   4. 過濾自己→自己（重試/同 page 連續）
//   5. UPSERT 到 page_type_transitions（同 (field,from,to) 直接覆寫）
//
// 注意：
//   - 我們只統計「成功路徑」（page_complete），所以 successCount === totalCount
//   - 機率代表「成功玩家在做完 from 後最常去的 to」
//   - 用於後續 sampler 推薦合理銜接
//
// 排程：
//   每週 cron task 7 跑一次（資料量大，不需每天）

import { sql, eq, and, isNotNull, gte, asc } from "drizzle-orm";
import { db } from "../db";
import {
  playerEventLogs,
  pages,
  pageTypeTransitions,
} from "@shared/schema";

export interface TrainOptions {
  /** 場域過濾（不指定則全部場域） */
  fieldId?: string;
  /** 訓練窗口（最近幾天，預設 90） */
  days?: number;
}

export interface TrainStats {
  fieldsProcessed: number;
  sessionsAnalyzed: number;
  transitionsUpserted: number;
  totalEvents: number;
  durationMs: number;
}

/**
 * 訓練 transition matrix
 * 從 player_event_logs 拿成功路徑 → 兩兩相鄰計 transition → UPSERT
 */
export async function trainTransitionMatrix(
  options: TrainOptions = {},
): Promise<TrainStats> {
  const startedAt = Date.now();
  const days = options.days ?? 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. 取近 N 天所有 page_complete 事件（join pages 拿 pageType）
  const filters = [
    eq(playerEventLogs.eventType, "page_complete"),
    isNotNull(playerEventLogs.fieldId),
    isNotNull(playerEventLogs.pageId),
    isNotNull(playerEventLogs.sessionId),
    gte(playerEventLogs.createdAt, since),
  ];
  if (options.fieldId) {
    filters.push(eq(playerEventLogs.fieldId, options.fieldId));
  }

  const events = await db
    .select({
      fieldId: playerEventLogs.fieldId,
      sessionId: playerEventLogs.sessionId,
      pageId: playerEventLogs.pageId,
      pageType: pages.pageType,
      createdAt: playerEventLogs.createdAt,
    })
    .from(playerEventLogs)
    .innerJoin(pages, eq(pages.id, playerEventLogs.pageId))
    .where(and(...filters))
    .orderBy(asc(playerEventLogs.sessionId), asc(playerEventLogs.createdAt));

  const totalEvents = events.length;

  if (totalEvents === 0) {
    return {
      fieldsProcessed: 0,
      sessionsAnalyzed: 0,
      transitionsUpserted: 0,
      totalEvents: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  // 2. 按 (fieldId, sessionId) 分組
  const sessions = new Map<
    string,
    Array<{ pageType: string; createdAt: Date }>
  >();
  for (const e of events) {
    if (!e.fieldId || !e.sessionId || !e.pageType || !e.createdAt) continue;
    const key = `${e.fieldId}|${e.sessionId}`;
    let arr = sessions.get(key);
    if (!arr) {
      arr = [];
      sessions.set(key, arr);
    }
    arr.push({
      pageType: e.pageType,
      createdAt: new Date(e.createdAt),
    });
  }

  // 3. 對每個 session，兩兩相鄰計算 transition（過濾自己→自己）
  const counts = new Map<
    string,
    { fieldId: string; from: string; to: string; count: number }
  >();

  for (const [key, pages] of Array.from(sessions.entries())) {
    const fieldId = key.split("|")[0];
    for (let i = 0; i < pages.length - 1; i++) {
      const from = pages[i].pageType;
      const to = pages[i + 1].pageType;
      if (from === to) continue; // 過濾重試
      const ckey = `${fieldId}|${from}|${to}`;
      const existing = counts.get(ckey) ?? { fieldId, from, to, count: 0 };
      existing.count++;
      counts.set(ckey, existing);
    }
  }

  // 4. UPSERT 到 page_type_transitions
  const fieldsSet = new Set<string>();
  let upserted = 0;
  const now = new Date();

  for (const t of Array.from(counts.values())) {
    await db
      .insert(pageTypeTransitions)
      .values({
        fieldId: t.fieldId,
        fromType: t.from,
        toType: t.to,
        successCount: t.count,
        totalCount: t.count,
        lastTrainedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          pageTypeTransitions.fieldId,
          pageTypeTransitions.fromType,
          pageTypeTransitions.toType,
        ],
        set: {
          successCount: t.count,
          totalCount: t.count,
          lastTrainedAt: now,
        },
      });
    upserted++;
    fieldsSet.add(t.fieldId);
  }

  return {
    fieldsProcessed: fieldsSet.size,
    sessionsAnalyzed: sessions.size,
    transitionsUpserted: upserted,
    totalEvents,
    durationMs: Date.now() - startedAt,
  };
}
