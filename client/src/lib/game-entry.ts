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
