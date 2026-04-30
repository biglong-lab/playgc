// 🎰 Multi-Armed Bandit 變體選擇演算法
//
// 核心問題：
//   有 N 個變體（arms），玩家對每個變體有 like/dislike 統計，
//   下次該選哪一個給玩家看？
//
// 兩個經典策略：
//   1. UCB1（Upper Confidence Bound）— 樂觀面對未知，給少嘗試的 arm 一個機會
//   2. Epsilon-greedy — ε 機率隨機探索，1-ε 機率挑最高分
//
// 冷啟動：
//   每個 arm 至少強制曝光 N 次才參與排名（避免新變體永遠被埋沒）
//
// 用法：
//   const arms: BanditArm[] = variants.map((v, i) => ({
//     id: `${key}|${i}`,
//     pulls: scores[`${key}|${i}`]?.totalFeedback ?? 0,
//     reward: scores[`${key}|${i}`]?.score ?? 0.5,  // Wilson [0,1]
//     hidden: scores[`${key}|${i}`]?.hidden ?? false,
//   }));
//   const picked = banditPick(arms, { strategy: "ucb1" });

export interface BanditArm {
  /** Arm 識別（給呼叫者追蹤用） */
  id: string;
  /** 被選次數（pulls / exposures） */
  pulls: number;
  /** 平均獎勵（[0, 1] 範圍，建議用 Wilson Lower Bound） */
  reward: number;
  /** 是否隱藏（auto-hidden 連續 dislike）— hidden 完全不選 */
  hidden?: boolean;
}

export interface BanditOptions {
  /** 策略（預設 ucb1） */
  strategy?: "ucb1" | "epsilon-greedy" | "thompson-like";
  /** Epsilon-greedy 的 ε（預設 0.1） */
  epsilon?: number;
  /** 冷啟動：強制曝光次數（預設 3） */
  coldStartMin?: number;
  /** UCB1 的 c 常數（探索強度，預設 sqrt(2)） */
  ucbConstant?: number;
}

export interface BanditResult {
  /** 選中的 arm id */
  pickedId: string;
  /** 選擇原因（debug 用） */
  reason:
    | "cold-start"      // 冷啟動強制曝光
    | "ucb1"            // UCB1 最高分
    | "exploit"         // Epsilon-greedy 利用
    | "explore"         // Epsilon-greedy 探索
    | "thompson"        // Thompson sampling
    | "single-arm"      // 只有 1 個可用
    | "all-hidden";     // 全部 hidden（fallback 第一個）
  /** 該 arm 的 score（依策略不同含義） */
  score: number;
  /** 候選 arm 數量（被排除 hidden 後） */
  candidateCount: number;
}

/**
 * 從 arms 選一個 — 主入口
 */
export function banditPick(
  arms: BanditArm[],
  options: BanditOptions = {},
): BanditResult {
  const {
    strategy = "ucb1",
    epsilon = 0.1,
    coldStartMin = 3,
    ucbConstant = Math.SQRT2,
  } = options;

  // 過濾 hidden
  const candidates = arms.filter((a) => !a.hidden);
  if (candidates.length === 0) {
    // 全 hidden：fallback 回第一個（保證不返回 null）
    return {
      pickedId: arms[0]?.id ?? "",
      reason: "all-hidden",
      score: 0,
      candidateCount: 0,
    };
  }

  if (candidates.length === 1) {
    return {
      pickedId: candidates[0].id,
      reason: "single-arm",
      score: candidates[0].reward,
      candidateCount: 1,
    };
  }

  // 冷啟動：找未達 coldStartMin pulls 的，優先選一個（隨機）
  const undersampled = candidates.filter((a) => a.pulls < coldStartMin);
  if (undersampled.length > 0) {
    const picked = undersampled[Math.floor(Math.random() * undersampled.length)];
    return {
      pickedId: picked.id,
      reason: "cold-start",
      score: picked.reward,
      candidateCount: candidates.length,
    };
  }

  // 全部過了冷啟動，依策略選
  if (strategy === "epsilon-greedy") {
    if (Math.random() < epsilon) {
      // 探索：隨機選
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      return {
        pickedId: picked.id,
        reason: "explore",
        score: picked.reward,
        candidateCount: candidates.length,
      };
    }
    // 利用：選最高 reward
    const best = candidates.reduce((a, b) => (a.reward >= b.reward ? a : b));
    return {
      pickedId: best.id,
      reason: "exploit",
      score: best.reward,
      candidateCount: candidates.length,
    };
  }

  if (strategy === "thompson-like") {
    // 簡易 Thompson sampling-like：reward 加上小擾動排序
    let bestId = candidates[0].id;
    let bestSample = -Infinity;
    for (const a of candidates) {
      // 樣本越少擾動越大（仿 Beta distribution variance）
      const variance = 1 / Math.max(a.pulls, 1);
      const sample = a.reward + (Math.random() - 0.5) * variance;
      if (sample > bestSample) {
        bestSample = sample;
        bestId = a.id;
      }
    }
    const picked = candidates.find((a) => a.id === bestId)!;
    return {
      pickedId: bestId,
      reason: "thompson",
      score: bestSample,
      candidateCount: candidates.length,
    };
  }

  // 預設：UCB1
  // ucb_score = reward + c * sqrt(ln(total_pulls) / arm_pulls)
  const totalPulls = candidates.reduce((sum, a) => sum + a.pulls, 0);
  const lnTotal = Math.log(Math.max(totalPulls, 1));

  let bestId = candidates[0].id;
  let bestScore = -Infinity;
  for (const a of candidates) {
    const exploration = ucbConstant * Math.sqrt(lnTotal / Math.max(a.pulls, 1));
    const ucbScore = a.reward + exploration;
    if (ucbScore > bestScore) {
      bestScore = ucbScore;
      bestId = a.id;
    }
  }

  return {
    pickedId: bestId,
    reason: "ucb1",
    score: bestScore,
    candidateCount: candidates.length,
  };
}

/**
 * Helper：把 variantPool + scores 轉成 arms 陣列
 *
 * @param variants 變體陣列（從 variantPool[key] 取）
 * @param scores Map<"key|index", { totalFeedback, score, hidden }>
 * @param key 變體類別（success / fail / ...）
 */
export function buildArmsFromVariants(
  variants: string[],
  scores: Map<string, { totalFeedback?: number; score?: number; hidden?: boolean }> | Record<string, { totalFeedback?: number; score?: number; hidden?: boolean }>,
  key: string,
): BanditArm[] {
  const getScore = (k: string) => {
    if (scores instanceof Map) return scores.get(k);
    return (scores as Record<string, unknown>)[k] as { totalFeedback?: number; score?: number; hidden?: boolean } | undefined;
  };

  return variants.map((_, idx) => {
    const k = `${key}|${idx}`;
    const sc = getScore(k);
    return {
      id: k,
      pulls: sc?.totalFeedback ?? 0,
      reward: sc?.score ?? 0.5, // 沒反饋 = 中性 0.5
      hidden: sc?.hidden ?? false,
    };
  });
}
