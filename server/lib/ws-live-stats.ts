// 📊 WS 即時狀態 — 活動當天要盯的數字（2026-08-05）
//
// 為什麼是「最大單隊人數」而不是「總連線數」：
// 2026-08-05 壓測實測，瓶頸完全在廣播扇出，不在連線數 ——
//   500 連線分散在 100 隊 → 廣播 p95 7ms
//   500 連線擠在同 1 隊   → 廣播 p95 5254ms（差 750 倍）
// 因為同隊每則訊息要寫給 N-1 個 socket，訊息量隨隊伍人數呈 N² 成長。
// 所以活動當天總人數多不可怕，某一隊爆掉才可怕。

/**
 * 風險門檻 —— 依 2026-08-05 實測曲線（1 隊 × N 人，廣播 p95）：
 *
 *   100 人 →    9ms  ┐
 *   200 人 →   14ms  ├ 舒適區
 *   300 人 →   68ms  ┘
 *   400 人 →  460ms  ← 明顯劣化
 *   500 人 → 2051ms+ ← 崩潰（CPU 才 49.6%，塞住的是 event loop 不是算力）
 *
 * 拐點在 300–400 之間。門檻對生產打了約 5 折：壓測跑在本機 Mac，
 * 生產是 Linode vCPU，單核較慢，且同機還有 47 個容器在搶資源。
 * 若之後在生產實測出真實曲線，應以生產數字取代這裡。
 */
export const TEAM_SIZE_WARNING = 100;
export const TEAM_SIZE_CRITICAL = 200;

export type WsRiskLevel = "ok" | "warning" | "critical";

export interface WsLiveStats {
  /** 目前 WS 連線總數 */
  totalConnections: number;
  /** 有人在的隊伍房間數 */
  teamRooms: number;
  /** 🔑 最大單隊人數 —— 扇出風險的關鍵指標 */
  largestTeamSize: number;
  largestTeamId: string | null;
  /** 有人在的 session 房間數 */
  sessionRooms: number;
  largestSessionSize: number;
  /** 依壓測門檻判定的風險等級 */
  risk: WsRiskLevel;
  /** 人數 >= WARNING 的隊伍（活動當天要盯的對象）*/
  hotTeams: Array<{ teamId: string; size: number }>;
  generatedAt: string;
}

/** 房間 Map：roomId → 連線集合 */
type RoomMap = Map<string, Set<unknown>>;

function largestRoom(rooms: RoomMap): { id: string | null; size: number } {
  let id: string | null = null;
  let size = 0;
  rooms.forEach((set, key) => {
    if (set.size > size) {
      size = set.size;
      id = key;
    }
  });
  return { id, size };
}

function riskOf(largestTeamSize: number): WsRiskLevel {
  if (largestTeamSize >= TEAM_SIZE_CRITICAL) return "critical";
  if (largestTeamSize >= TEAM_SIZE_WARNING) return "warning";
  return "ok";
}

/**
 * 從 WS 的房間 Map 算出即時狀態。
 * 純函式、不碰 DB，呼叫成本極低（只走一次 Map），可以高頻輪詢。
 */
export function computeWsLiveStats(input: {
  totalConnections: number;
  teamClients: RoomMap;
  sessionClients: RoomMap;
  now?: Date;
}): WsLiveStats {
  const { totalConnections, teamClients, sessionClients } = input;

  const team = largestRoom(teamClients);
  const session = largestRoom(sessionClients);

  const hotTeams: Array<{ teamId: string; size: number }> = [];
  teamClients.forEach((set, teamId) => {
    if (set.size >= TEAM_SIZE_WARNING) hotTeams.push({ teamId, size: set.size });
  });
  hotTeams.sort((a, b) => b.size - a.size);

  return {
    totalConnections,
    teamRooms: teamClients.size,
    largestTeamSize: team.size,
    largestTeamId: team.id,
    sessionRooms: sessionClients.size,
    largestSessionSize: session.size,
    risk: riskOf(team.size),
    hotTeams,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

/** 給人看的風險說明（後台直接顯示，不用前端再翻譯一次）*/
export function describeRisk(stats: WsLiveStats): string {
  switch (stats.risk) {
    case "critical":
      return `⛔ 最大隊伍 ${stats.largestTeamSize} 人，已超過 ${TEAM_SIZE_CRITICAL} 人風險線，廣播延遲可能達數秒`;
    case "warning":
      return `⚠️ 最大隊伍 ${stats.largestTeamSize} 人，接近單機舒適上限（${TEAM_SIZE_CRITICAL} 人）`;
    default:
      return `✅ 最大隊伍 ${stats.largestTeamSize} 人，在安全範圍內`;
  }
}
