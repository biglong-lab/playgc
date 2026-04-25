// 水彈玩家自評共識判斷 — 純函式（可單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §11.2

export interface SelfReport {
  reporterUserId: string;
  team: string;
  result: "win" | "loss" | "draw";
  reportedAt: Date;
}

export interface ConsensusResult {
  consistent: boolean;
  winningTeam?: string;
  isDraw?: boolean;
}

/**
 * 判斷雙方是否一致
 *
 * 規則：
 *   - 紅隊長報「win」AND 藍隊長報「loss」 → 一致（紅勝）
 *   - 紅隊長報「win」AND 藍隊長報「win」  → 不一致（爭議）
 *   - 雙方都報「draw」                     → 一致（平手）
 *   - 一方報 draw 一方報 win/loss          → 不一致
 */
export function checkConsensus(reports: SelfReport[]): ConsensusResult {
  // 一個 reporter 一份 → 取第一份（最早出現）
  const byReporter = new Map<string, SelfReport>();
  for (const r of reports) {
    if (!byReporter.has(r.reporterUserId)) {
      byReporter.set(r.reporterUserId, r);
    }
  }
  const uniq = Array.from(byReporter.values());
  if (uniq.length < 2) return { consistent: false };

  // 找紅隊長 + 藍隊長（不同 team）
  const teamReports = new Map<string, SelfReport>();
  for (const r of uniq) {
    if (!teamReports.has(r.team)) {
      teamReports.set(r.team, r);
    }
  }
  if (teamReports.size < 2) return { consistent: false }; // 兩個 reporter 同隊？資料異常

  const teamArr = Array.from(teamReports.values());
  const [a, b] = teamArr;

  // 雙方都 draw → 平手
  if (a.result === "draw" && b.result === "draw") {
    return { consistent: true, isDraw: true };
  }
  // a 贏 + b 輸 → a 勝
  if (a.result === "win" && b.result === "loss") {
    return { consistent: true, winningTeam: a.team };
  }
  // a 輸 + b 贏 → b 勝
  if (a.result === "loss" && b.result === "win") {
    return { consistent: true, winningTeam: b.team };
  }
  // 不一致
  return { consistent: false };
}
