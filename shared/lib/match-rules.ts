// 🏁 賽事開賽條件（前後端共用，2026-09-23 P1）
//   伺服器 POST /api/matches/:id/start 用它擋；大廳用它決定按鈕能不能按、顯示還差什麼

export interface MatchStartInput {
  matchMode: string;
  participantCount: number;
  /** 競賽：最少人數 */
  minParticipants: number;
  /** 接力：分段數（一人一棒） */
  relayLegCount: number;
}

/** 回傳還不能開賽的原因；可以開賽回 null */
export function matchStartBlocker(input: MatchStartInput): string | null {
  const { participantCount: count } = input;
  if (input.matchMode === "relay") {
    const legs = input.relayLegCount;
    if (legs === 0) return "這個接力遊戲還沒設定分段，請場域管理員到遊戲設定補上";
    return count === legs ? null : `接力需要剛好 ${legs} 人（每人一棒），目前 ${count} 人`;
  }
  const min = input.minParticipants;
  return count >= min ? null : `至少需要 ${min} 人才能開始（還差 ${min - count} 人）`;
}

export interface RelaySegmentLike {
  fromPage: number;
  toPage: number;
}

/**
 * 接力分段檢查（遊戲設定頁即時提示 + 發佈檢查共用）
 * - errors（擋存檔 / 擋發佈）：沒有分段、頁碼超出範圍、結束頁小於起始頁
 * - warnings（提醒不擋）：分段重疊（同一頁兩棒都玩）、有頁面沒人玩
 */
export function validateRelaySegments(
  segments: readonly RelaySegmentLike[] | null | undefined,
  pageCount: number,
): { errors: string[]; warnings: string[] } {
  const list = segments ?? [];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (list.length === 0) errors.push("接力遊戲至少要設定 1 棒");
  list.forEach((s, i) => {
    const label = `第 ${i + 1} 棒`;
    if (s.fromPage < 1 || s.toPage > pageCount) errors.push(`${label}的頁碼超出範圍（這款遊戲共 ${pageCount} 頁）`);
    if (s.toPage < s.fromPage) errors.push(`${label}的結束頁不能小於起始頁`);
  });
  const covered = new Map<number, number>();
  list.forEach((s) => {
    for (let p = Math.max(1, s.fromPage); p <= Math.min(pageCount, s.toPage); p++) covered.set(p, (covered.get(p) ?? 0) + 1);
  });
  if (Array.from(covered.values()).some((n) => n > 1)) warnings.push("有頁面同時分給兩棒（會重複玩）");
  if (pageCount > 0 && list.length > 0 && covered.size < pageCount) warnings.push("有頁面沒有分給任何一棒（不會有人玩到）");
  return { errors, warnings };
}

/** 平均分段：共 pageCount 頁分給 legs 棒（前面幾棒多分到餘數頁） */
export function evenRelaySegments(pageCount: number, legs: number): RelaySegmentLike[] {
  const n = Math.max(1, Math.min(Math.floor(legs), pageCount));
  if (pageCount < 1) return [];
  const base = Math.floor(pageCount / n);
  const extra = pageCount % n;
  const out: RelaySegmentLike[] = [];
  let from = 1;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push({ fromPage: from, toPage: from + size - 1 });
    from += size;
  }
  return out;
}

/** 遊戲設定存檔前檢查（競賽 / 接力）：回傳要擋下的原因；沒問題回 null */
export function matchConfigSaveError(
  mode: string,
  cfg: { minParticipants?: number; maxParticipants?: number; relaySegments?: RelaySegmentLike[] } | null | undefined,
  pageCount: number,
): string | null {
  if (mode === "relay") {
    if (pageCount === 0) return "這款遊戲還沒有頁面，請先到編輯器加頁面，再回來設定接力分段";
    return validateRelaySegments(cfg?.relaySegments, pageCount).errors[0] ?? null;
  }
  if (mode === "competitive") {
    const min = cfg?.minParticipants ?? 2;
    const max = cfg?.maxParticipants ?? 10;
    return min > max ? "競賽的最少人數不能大於最多人數" : null;
  }
  return null;
}
