// 🎯 遊戲計分開關判斷（2026-09-22，前後端共用）
// games.scoring_enabled：null / undefined 視為開啟（既有遊戲行為不變）

export function isScoringEnabled(game: { scoringEnabled?: boolean | null } | null | undefined): boolean {
  return game?.scoringEnabled !== false;
}
