// 🚦 發佈前檢查（2026-09-23，前後端共用同一支純函式）
//
// 用途：遊戲改成 published 之前跑一次，不合格就擋。
//   - 後端 POST /api/admin/games/:id/publish：不合格回 400 not_publishable
//   - 前端遊戲列表「發布」鈕：先跑一次，不合格直接列出問題，不打 API
// 檢查項目：
//   1. 遊戲名稱不可空白
//   2. 至少 1 頁
//   3. 每頁 pageType 必須是玩家端能渲染的類型（PLAYABLE_PAGE_TYPES）
//   4. 沿用編輯器既有的頁面必要欄位 + 跨頁流程檢查（只有 error 等級會擋，warning 不擋）
import { validateAllPages, formatIssue, type PageLike } from "./page-config-validation";
import { isPlayablePageType } from "./page-types";

/** 遊戲狀態白名單 */
export const GAME_STATUSES = ["draft", "published", "archived"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export function isGameStatus(value: unknown): value is GameStatus {
  return typeof value === "string" && (GAME_STATUSES as readonly string[]).includes(value);
}

export interface PublishCheckError {
  /** 問題出在哪一頁（遊戲層級問題則無） */
  pageId?: string;
  message: string;
}

export interface PublishCheckResult {
  ok: boolean;
  errors: PublishCheckError[];
}

interface GameLike {
  title?: string | null;
}

function checkPageTypes(pages: readonly PageLike[]): PublishCheckError[] {
  return pages
    .filter((p) => !isPlayablePageType(p.pageType))
    .map((p) => ({
      pageId: p.id,
      message: `第 ${p.pageOrder} 頁：不支援的頁面類型「${p.pageType}」，玩家端無法顯示`,
    }));
}

function checkPageConfigs(pages: readonly PageLike[]): PublishCheckError[] {
  // 類型不合法的頁已在上一步回報，這裡只驗合法類型，避免同一頁重複報
  const playable = pages.filter((p) => isPlayablePageType(p.pageType));
  return validateAllPages([...playable])
    .filter((issue) => issue.severity === "error")
    .map((issue) => ({ pageId: issue.pageId, message: formatIssue(issue) }));
}

/**
 * 檢查遊戲是否可以發佈
 * @param game 遊戲（只看 title）
 * @param pages 遊戲的所有頁面（null / undefined 視為 0 頁）
 */
export function checkGamePublishable(
  game: GameLike | null | undefined,
  pages: readonly PageLike[] | null | undefined,
): PublishCheckResult {
  const list = pages ?? [];
  const errors: PublishCheckError[] = [];

  if (!game?.title?.trim()) {
    errors.push({ message: "遊戲缺少名稱" });
  }
  if (list.length === 0) {
    errors.push({ message: "遊戲至少需要 1 個頁面才能發佈" });
  }
  errors.push(...checkPageTypes(list), ...checkPageConfigs(list));

  return { ok: errors.length === 0, errors };
}
