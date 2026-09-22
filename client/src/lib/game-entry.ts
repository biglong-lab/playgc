// 🧭 遊戲入口路徑規則（大廳卡片、QR 過場頁共用 — 2026-09-22 統一）
// 依遊戲結構 / 模式決定玩家該先進哪一頁；回傳不含 /f/:code 前綴的相對路徑。

export interface GameEntrySource {
  id: string;
  gameMode?: string | null;
  gameStructure?: string | null;
}

export function getGameEntryPath(game: GameEntrySource): string {
  if (game.gameStructure === "chapters") return `/game/${game.id}/chapters`;
  if (game.gameMode === "competitive" || game.gameMode === "relay") return `/match/${game.id}`;
  if (game.gameMode === "team") return `/team/${game.id}`;
  return `/game/${game.id}`;
}

/** 是否為單人直接開玩的遊戲（不需先經過章節 / 組隊 / 賽事大廳） */
export function isDirectPlayGame(game: GameEntrySource): boolean {
  return getGameEntryPath(game) === `/game/${game.id}`;
}

export interface QrEntryGame extends GameEntrySource {
  field?: { code?: string | null } | null;
}

/** QR 進場標記：遊戲頁據此「已通關就直接開新局」（見 useSessionManager autoRestartCompleted） */
export const QR_ENTRY_PARAM = "entry";
export const QR_ENTRY_VALUE = "qr";

/**
 * 掃 QR（/g/:slug）後的直達路徑
 * - 套遊戲所屬場域前綴 /f/{code}（原本取「上次造訪場域」→ 新手機會落到錯的場域）
 * - 保留原網址參數（例如組隊邀請 ?code=）
 * - 單人遊戲加 entry=qr
 */
export function buildQrEntryTarget(game: QrEntryGame, search = ""): string {
  const code = game.field?.code?.trim();
  const prefix = code ? `/f/${code.toUpperCase()}` : "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (isDirectPlayGame(game)) params.set(QR_ENTRY_PARAM, QR_ENTRY_VALUE);
  const qs = params.toString();
  return `${prefix}${getGameEntryPath(game)}${qs ? `?${qs}` : ""}`;
}
