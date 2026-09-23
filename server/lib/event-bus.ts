// 📣 輕量事件匯流排（P2 底座，2026-09-23）
//
// hung-blocks L1 通訊決策樹：「要立即結果的讀 → 呼叫入口函式；通知別人發生了事 → 發事件」
//   發布端不需要知道誰訂閱；訂閱端出錯不能拖垮發布端。
//
// 刻意做得很小（單一 process、記憶體內、不持久化）：
//   - 現在的規模用不到 Kafka / Redis，單 worker 架構（CLUSTER_WORKERS=0）也不需要跨 process
//   - 需要保證送達的事情不要用事件，直接呼叫（例如付款、扣庫存）
//   - 訂閱者要自己冪等（同一事件可能因重試被送兩次）
import type { FieldProvisionedEvent } from "@shared/lib/domain-events";

export interface DomainEvents {
  "field.provisioned": FieldProvisionedEvent;
}

type EventName = keyof DomainEvents;
type Handler<K extends EventName> = (payload: DomainEvents[K]) => void | Promise<void>;

const handlers = new Map<EventName, Set<Handler<EventName>>>();

/** 訂閱事件；回傳取消訂閱的函式 */
export function onEvent<K extends EventName>(name: K, handler: Handler<K>): () => void {
  const set = handlers.get(name) ?? new Set();
  set.add(handler as Handler<EventName>);
  handlers.set(name, set);
  return () => {
    set.delete(handler as Handler<EventName>);
  };
}

/**
 * 發布事件（不等待訂閱者、不會拋錯）
 * 訂閱者的錯誤在這裡被隔離並記錄 —— 通知失敗不能讓開通流程失敗
 */
export function emitEvent<K extends EventName>(name: K, payload: DomainEvents[K]): void {
  const set = handlers.get(name);
  if (!set || set.size === 0) return;
  for (const handler of Array.from(set)) {
    try {
      const result = handler(payload);
      if (result instanceof Promise) {
        result.catch((err) => console.error(`[event-bus] ${name} 訂閱者失敗:`, err));
      }
    } catch (err) {
      console.error(`[event-bus] ${name} 訂閱者失敗:`, err);
    }
  }
}

/** 測試用：清掉所有訂閱 */
export function resetEventBus(): void {
  handlers.clear();
}

/** 目前訂閱數（觀察 / 測試用） */
export function subscriberCount(name: EventName): number {
  return handlers.get(name)?.size ?? 0;
}
