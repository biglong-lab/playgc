// Squad 計分公式 — 純函式模組（不依賴 DB）
// 從 routes/squad-records.ts 抽出，方便單元測試
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §6 + §7

// ============================================================================
// 基礎公式
// ============================================================================

/**
 * ELO 預期勝率
 * @returns 0.0-1.0 的預期值
 */
export function eloExpected(myRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

/**
 * 取得 K 值（場次越多 K 越小，防 farm）
 * SQUAD_SYSTEM_DESIGN §6.5
 */
export function getKValue(totalGames: number): number {
  if (totalGames <= 10) return 32; // 新手
  if (totalGames <= 50) return 24; // 中段
  return 16; // 老手
}

/**
 * PvE 期望完成度（依 rating 推算）
 * SQUAD_SYSTEM_DESIGN §6.3
 */
export function pveExpectedCompletion(rating: number): number {
  if (rating < 1200) return 0.5;
  if (rating < 1400) return 0.65;
  if (rating < 1600) return 0.8;
  if (rating < 1800) return 0.9;
  return 0.95;
}

/**
 * 對手強度差距 cap（防欺負弱小 / 鼓勵爆冷）
 * SQUAD_SYSTEM_DESIGN §19.2
 */
export function capDeltaByOpponentDiff(delta: number, ratingDiff: number, isWin: boolean): number {
  if (ratingDiff > 400) {
    if (isWin) return delta * 0.3; // 贏了只加 30%
    return delta * 1.0;             // 輸了正常扣分
  }
  if (ratingDiff < -400) {
    if (isWin) return delta * 1.5; // 大爆冷
    return delta * 0.5;             // 少扣
  }
  return delta;
}

/** 段位推算 */
export function deriveTier(rating: number): string {
  if (rating >= 1800) return "master";
  if (rating >= 1600) return "diamond";
  if (rating >= 1400) return "gold";
  if (rating >= 1200) return "silver";
  return "bronze";
}

// ============================================================================
// 主計分函式
// ============================================================================

export interface CalcInput {
  myRating: number;
  opponentRating?: number;       // PvP 用
  result: string;                // win/loss/draw/completed/failed/participated/achieved
  performance: Record<string, unknown>;
  totalGames: number;
  isCrossField: boolean;
  isFirstVisit: boolean;
  scoringMode: "pvp" | "pve" | "experience" | "coop" | "personal";
}

export interface CalcResult {
  ratingChange: number;
  expPoints: number;
  gameCountMultiplier: number; // 100 / 120 / 200
}

/**
 * 統一計分函式（核心）
 * 詳見 SQUAD_SYSTEM_DESIGN §6 §7
 */
export function calcRewards(input: CalcInput): CalcResult {
  const {
    myRating, opponentRating = 1200, result, performance,
    totalGames, isCrossField, isFirstVisit, scoringMode,
  } = input;

  // 場次倍率
  let gameCountMultiplier = 100;
  if (isFirstVisit) gameCountMultiplier = 200;
  else if (isCrossField) gameCountMultiplier = 120;

  // Mode C: 純體驗 — 不算 rating，只給體驗點數
  if (scoringMode === "experience" || result === "participated") {
    let expPoints = 100; // 基礎
    if (isCrossField) expPoints = Math.round(expPoints * 1.2);
    if (isFirstVisit) expPoints = Math.round(expPoints * 2);

    const photoCount = (performance.photoCount as number) ?? 0;
    if (photoCount > 0) expPoints += 20;

    const memberCount = (performance.memberCount as number) ?? 0;
    if (memberCount >= 5) expPoints += 30;

    return { ratingChange: 0, expPoints, gameCountMultiplier };
  }

  // 計算 actual score
  let actual: number;
  if (scoringMode === "pvp") {
    // 🆕 Phase 15.5：名次型計算（接力 8 隊 rank → actual 線性插值）
    // performance.rank：1 是第一名 / totalParticipants：總隊數
    const rank = performance.rank as number | undefined;
    const totalParticipants = performance.totalParticipants as number | undefined;
    if (rank && totalParticipants && totalParticipants > 1) {
      // rank 1 → actual 1.0；rank N → actual 0.0；中間線性插值
      // 設計文件 §6.4：actual = (totalParticipants - rank) / (totalParticipants - 1)
      actual = (totalParticipants - rank) / (totalParticipants - 1);
    } else {
      actual = result === "win" ? 1.0 : (result === "draw" ? 0.5 : 0.0);
    }
  } else if (scoringMode === "pve") {
    // 完成度當作 actual
    actual = (performance.completionRate as number) ?? (result === "completed" ? 1.0 : 0.5);
  } else if (scoringMode === "personal") {
    // 個人挑戰 — 突破才加分
    actual = result === "achieved" ? 1.0 : 0.5;
  } else {
    // coop — 完成全隊都加
    actual = result === "completed" ? 1.0 : 0.0;
  }

  // 期望值
  let expected: number;
  if (scoringMode === "pvp") {
    expected = eloExpected(myRating, opponentRating);
  } else if (scoringMode === "pve") {
    expected = pveExpectedCompletion(myRating);
  } else {
    expected = 0.5; // 中性
  }

  // 基礎 ELO delta
  const K = getKValue(totalGames);
  let delta = K * (actual - expected);

  // 表現 bonus（加法）
  if (performance.isMvp) delta += 5;
  if ((performance.deaths as number) === 0) delta += 3;
  if ((performance.completionRate as number) === 1.0) delta += 2;
  // 🆕 Phase 15.6：用時 < 平均 50% 加成
  if (performance.duration && performance.avgDuration) {
    const duration = performance.duration as number;
    const avgDuration = performance.avgDuration as number;
    if (avgDuration > 0 && duration < avgDuration * 0.5) {
      delta += 2;
    }
  }
  // 🆕 Phase 15.6：全員存活加成（無傷通關）
  if (performance.allMembersSurvived === true) {
    delta += 2;
  }

  // 場域加成（乘法）
  if (isFirstVisit) delta *= 2.0;
  else if (isCrossField) delta *= 1.2;

  // 對手強度限制
  delta = capDeltaByOpponentDiff(delta, myRating - opponentRating, result === "win");

  return {
    ratingChange: Math.round(delta),
    expPoints: 0,
    gameCountMultiplier,
  };
}
