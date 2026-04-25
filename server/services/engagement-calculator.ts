// 場域行銷計算器 — 純函式，方便測試
//
// 包含：
//   - 超級隊長判定（自動 + 手動 hybrid）
//   - 歡迎隊伍選取（auto / manual / hybrid）
//   - 隊伍狀態判斷（活躍 / 休眠）
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13 §14 §18

// ============================================================================
// 1. 超級隊長判定
// ============================================================================

export interface SquadProfile {
  squadId: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  recruitsCount: number;
  fieldsPlayed: string[];
  lastActiveAt?: Date | string | null;
}

export interface SuperLeaderConfig {
  minGames: number;
  minRecruits: number;
  minFields: number;
  minWinRate: number;        // 50 = 50%
  autoEnabled: boolean;
  manualIds: string[];
}

/**
 * 判斷某隊伍是否為超級隊長
 *
 * 邏輯：
 *   1. 在 manualIds 內 → 永遠是
 *   2. autoEnabled = true 且滿足所有自動條件 → 是
 *   3. 否則 → 否
 */
export function isSuperLeader(squad: SquadProfile, config: SuperLeaderConfig): boolean {
  // 手動指定優先（永遠認）
  if (config.manualIds.includes(squad.squadId)) return true;

  // 自動關閉 → 只看 manual
  if (!config.autoEnabled) return false;

  // 自動條件（全部要滿足）
  if (squad.totalGames < config.minGames) return false;
  if (squad.recruitsCount < config.minRecruits) return false;
  if (squad.fieldsPlayed.length < config.minFields) return false;

  const totalDecisive = squad.totalWins + squad.totalLosses;
  const winRate = totalDecisive > 0 ? Math.round((squad.totalWins / totalDecisive) * 100) : 0;
  if (winRate < config.minWinRate) return false;

  return true;
}

// ============================================================================
// 2. 歡迎隊伍選取
// ============================================================================

export interface WelcomeSquadConfig {
  mode: "auto" | "manual" | "hybrid";
  autoTopN: number;
  autoCriteria: "total_games" | "rating" | "recent_active";
  manualIds: string[];
}

export interface SquadForRanking extends SquadProfile {
  rating?: number;        // 用於 rating criteria
}

/**
 * 取得場域歡迎隊伍清單
 *
 * 三種模式：
 *   - auto: 從 squads 排序取 top N
 *   - manual: 直接用 manualIds
 *   - hybrid: manual 優先，剩下空格補 auto
 */
export function selectWelcomeSquads(
  squads: SquadForRanking[],
  config: WelcomeSquadConfig,
): SquadForRanking[] {
  // Manual 模式：只取手動指定
  if (config.mode === "manual") {
    return squads.filter((s) => config.manualIds.includes(s.squadId));
  }

  // Auto 排序
  const sorted = sortByCriteria(squads, config.autoCriteria);

  // Auto 模式：直接取 top N
  if (config.mode === "auto") {
    return sorted.slice(0, config.autoTopN);
  }

  // Hybrid 模式：manual 優先 + auto 補
  const manualSet = new Set(config.manualIds);
  const manualSquads = squads.filter((s) => manualSet.has(s.squadId));

  // Auto 補進來（排除 manual 已有的）
  const remaining = config.autoTopN - manualSquads.length;
  if (remaining <= 0) return manualSquads.slice(0, config.autoTopN);

  const autoFill = sorted.filter((s) => !manualSet.has(s.squadId)).slice(0, remaining);
  return [...manualSquads, ...autoFill];
}

function sortByCriteria(
  squads: SquadForRanking[],
  criteria: "total_games" | "rating" | "recent_active",
): SquadForRanking[] {
  const sorted = [...squads];
  switch (criteria) {
    case "total_games":
      sorted.sort((a, b) => b.totalGames - a.totalGames);
      break;
    case "rating":
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "recent_active":
      sorted.sort((a, b) => {
        const ad = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bd = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bd - ad;
      });
      break;
  }
  return sorted;
}

// ============================================================================
// 3. 隊伍狀態判斷（活躍 / 休眠）
// ============================================================================

export interface DormancyConfig {
  daysThreshold: number;          // 多少天視為休眠
  warningDays: number[];          // 召回信日期（[3, 7, 14]）
}

export type SquadActivityStatus = "active" | "warning_3" | "warning_7" | "warning_14" | "dormant";

/**
 * 判斷隊伍當下狀態
 *
 * 邏輯：
 *   - 上次活動 < 3 天 → active
 *   - 3-6 天 → warning_3（送第 1 封召回）
 *   - 7-13 天 → warning_7（送第 2 封）
 *   - 14-(threshold-1) 天 → warning_14（送第 3 封）
 *   - >= threshold 天 → dormant（標記休眠）
 */
export function determineActivityStatus(
  lastActiveAt: Date | string | null | undefined,
  config: DormancyConfig,
  now: Date = new Date(),
): SquadActivityStatus {
  if (!lastActiveAt) return "active"; // 沒紀錄 → 視為剛建立

  const lastDate = new Date(lastActiveAt);
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= config.daysThreshold) return "dormant";

  // 找對應的 warning 階段（按 warningDays 排序）
  const sortedWarnings = [...config.warningDays].sort((a, b) => a - b);
  let lastReachedWarning = 0;
  for (const w of sortedWarnings) {
    if (daysSince >= w) lastReachedWarning = w;
  }

  if (lastReachedWarning === 0) return "active";
  return `warning_${lastReachedWarning}` as SquadActivityStatus;
}

// ============================================================================
// 4. 通知冷卻判斷
// ============================================================================

/**
 * 判斷該事件是否在冷卻期內（避免 spam）
 */
export function isInCooldown(
  lastSentAt: Date | string | null | undefined,
  cooldownHours: number,
  now: Date = new Date(),
): boolean {
  if (!lastSentAt) return false;
  const last = new Date(lastSentAt);
  const diffMs = now.getTime() - last.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < cooldownHours;
}
