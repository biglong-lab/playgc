// ⏱️ useServerTimer — 用 server 權威時間做倒數計時
//
// 用途：避免 client clock skew 造成倒數時間不公平
//   - ChoiceVerifyRace 搶答：兩玩家不同 client time → server 廣播權威結束時間
//   - TerritoryCapture 時限：所有玩家看到同一個倒數
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §7.1（P2 項目）
//
// 演算法：
//   1. mount 時打 GET /api/time 拿 server now
//   2. 計算 offset = serverNow - clientNow（client 比 server 慢 → offset > 0）
//   3. 倒數時：serverTime = clientNow + offset
//   4. RTT/2 估算傳輸延遲（更精準可加，目前忽略）
//
// 簡化決策（MVP）：
//   - 不重複校準（mount 時打一次即可，client clock 不會邊玩邊跳）
//   - RTT 補償留給後續優化（差距通常 < 200ms 可忽略）

import { useEffect, useRef, useState } from "react";

interface UseServerTimerOptions {
  /** 啟用時自動 fetch /api/time（預設 true） */
  enabled?: boolean;
}

export interface ServerTimerState {
  /** server 與 client 的 offset（毫秒，正值 = client 慢於 server） */
  offsetMs: number;
  /** 是否已校準完成（fetch 完 /api/time） */
  ready: boolean;
  /** 取得當前 server time（毫秒） */
  serverNow: () => number;
}

/**
 * 用 server 權威時間取代 client 純 Date.now() 倒數
 *
 * @example
 *   const { ready, serverNow } = useServerTimer();
 *   const remainingSec = ready ? Math.max(0, Math.floor((endAt - serverNow()) / 1000)) : 0;
 */
export function useServerTimer({
  enabled = true,
}: UseServerTimerOptions = {}): ServerTimerState {
  const [offsetMs, setOffsetMs] = useState(0);
  const [ready, setReady] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const reqStart = Date.now();
        const res = await fetch("/api/time", { credentials: "include" });
        if (!res.ok) throw new Error("server time API failed");
        const data: { now: number } = await res.json();
        const reqEnd = Date.now();
        // RTT/2 補償：假設來回時間平分，server now 對應到 client 的 (reqStart + reqEnd) / 2
        const clientMid = (reqStart + reqEnd) / 2;
        const offset = data.now - clientMid;

        if (!cancelled) {
          offsetRef.current = offset;
          setOffsetMs(offset);
          setReady(true);
        }
      } catch {
        // fetch 失敗 → 用純 client time（offset=0），不阻塞遊戲
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const serverNow = () => Date.now() + offsetRef.current;

  return { offsetMs, ready, serverNow };
}
