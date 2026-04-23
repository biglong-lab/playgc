// 🛡️ 射擊任務作弊防護
//
// 已知作弊管道：
// 1. devtools 直接改 React state（totalScore）
// 2. 偽造 WebSocket shooting_hit 事件（若 server 端驗證不足）
// 3. 按住「模擬命中」按鈕連點
// 4. 重放攻擊：同一 record 重複計分
//
// 本模組提供 client-side 的第一層防護：
//   - 命中節流：太快連續 hit 視為作弊
//   - 分數上限：單次最多 100 分，總分不超過硬性上限
//   - 次數上限：避免 hits array 爆掉
//   - production 禁用 simulation 按鈕（即使 admin config 設為 true）
//
// 這只是「提高作弊成本」，無法 100% 防；server-side 驗證才是真防線
// （後續可在 onComplete 把分數交給後端比對 shooting_records 實際總和）

/** 兩次命中最短間隔（ms）— 人手 + 硬體延遲極限約 50-100ms，低於此視為 bot */
export const MIN_HIT_INTERVAL_MS = 50;

/** 單次命中最高分（bullseye = 100） */
export const MAX_SCORE_PER_HIT = 100;

/** hits array 硬性上限倍率 — 防止 DoS / state 爆炸 */
export const MAX_HITS_MULTIPLIER = 3;

/** 模擬命中按鈕在 production 時強制隱藏 */
export function isSimulationAllowed(
  configAllowSimulation: boolean | undefined,
): boolean {
  if (!configAllowSimulation) return false;
  // Vite: import.meta.env.PROD = true 於 production build
  try {
    // 讀取 env；測試環境沒有 import.meta.env 也要 graceful
    const isProd = typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.PROD === true;
    return !isProd;
  } catch {
    return false;
  }
}

export interface HitValidationResult {
  valid: boolean;
  reason?: "too_fast" | "score_too_high" | "over_limit" | "invalid_score";
  message?: string;
}

/** 驗證單次命中是否合法 */
export function validateHit(opts: {
  score: number;
  lastHitTime: number | null;
  currentHitCount: number;
  requiredHits: number;
  now?: number;
}): HitValidationResult {
  const now = opts.now ?? Date.now();

  // 1. 分數合法性（非負、不超過單次上限）
  if (typeof opts.score !== "number" || !Number.isFinite(opts.score) || opts.score < 0) {
    return {
      valid: false,
      reason: "invalid_score",
      message: "分數格式無效",
    };
  }
  if (opts.score > MAX_SCORE_PER_HIT) {
    return {
      valid: false,
      reason: "score_too_high",
      message: `單次命中分數超過上限（${opts.score} > ${MAX_SCORE_PER_HIT}）`,
    };
  }

  // 2. 命中間隔（過快 = 疑似 bot / 重放）
  if (opts.lastHitTime !== null) {
    const diff = now - opts.lastHitTime;
    if (diff < MIN_HIT_INTERVAL_MS) {
      return {
        valid: false,
        reason: "too_fast",
        message: `命中間隔過短（${diff}ms < ${MIN_HIT_INTERVAL_MS}ms）`,
      };
    }
  }

  // 3. 次數上限（3 倍需求次數作為硬上限）
  const cap = Math.max(opts.requiredHits * MAX_HITS_MULTIPLIER, 10);
  if (opts.currentHitCount >= cap) {
    return {
      valid: false,
      reason: "over_limit",
      message: `命中次數已達上限（${cap} 次）`,
    };
  }

  return { valid: true };
}

/** 最終總分合法性（提交前呼叫）— 檢查總分是否與 hits 資料一致，防 state 注入 */
export function validateFinalScore(opts: {
  hits: Array<{ score: number }>;
  totalScore: number;
}): { valid: boolean; expectedScore: number; message?: string } {
  const expected = opts.hits.reduce(
    (sum, h) => sum + (typeof h.score === "number" ? h.score : 0),
    0,
  );
  // 允許 1 分誤差（浮點）
  if (Math.abs(opts.totalScore - expected) > 1) {
    return {
      valid: false,
      expectedScore: expected,
      message: `總分不一致：state=${opts.totalScore} vs hits.sum=${expected}`,
    };
  }
  // 每次命中若都取得 bullseye，理論最高分
  const theoreticalMax = opts.hits.length * MAX_SCORE_PER_HIT;
  if (opts.totalScore > theoreticalMax) {
    return {
      valid: false,
      expectedScore: theoreticalMax,
      message: `總分超過理論上限：${opts.totalScore} > ${theoreticalMax}`,
    };
  }
  return { valid: true, expectedScore: expected };
}
