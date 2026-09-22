// 🚦 發佈把關（2026-09-23 P0-B 補完）：任何把遊戲改成 published 的入口都跑同一套檢查
//
// 入口：
//   - POST  /api/admin/games/:id/publish（遊戲列表 / 精靈）— P0-B 已接
//   - PATCH /api/admin/games/:id         （後台遊戲設定）
//   - PATCH /api/games/:id               （編輯器、遊戲設定頁）
// 原本後兩條收到 status=published 直接寫 DB → 0 頁遊戲也能發佈
import type { Response } from "express";
import { checkGamePublishable, type PublishCheckResult } from "@shared/lib/game-publishable";
import { storage } from "../storage";

export async function loadPublishCheck(gameId: string): Promise<PublishCheckResult> {
  const [game, pages] = await Promise.all([storage.getGame(gameId), storage.getPages(gameId)]);
  return checkGamePublishable(game ?? null, pages);
}

/**
 * 要改成 published 時檢查；不合格直接回 400（與 /publish 相同格式）並回傳 true = 已回應
 * 其他狀態（草稿 / 下架）一律放行
 */
export async function rejectIfNotPublishable(
  gameId: string, nextStatus: unknown, res: Response,
): Promise<boolean> {
  if (nextStatus !== "published") return false;
  const check = await loadPublishCheck(gameId);
  if (check.ok) return false;
  res.status(400).json({
    error: "not_publishable",
    message: `遊戲尚未符合發佈條件（${check.errors.length} 個問題），請先到編輯器修正`,
    errors: check.errors,
  });
  return true;
}
