// 精靈「發布遊戲」— 呼叫後台發布 API，並把失敗原因整理成可顯示的訊息
//
// 後端發布把關（前後端共用檢查）對不合格遊戲可能回 400 + 問題清單，
// 清單欄位名稱與格式尚未定案 → 這裡同時接受 errors / issues / problems / reasons，
// 項目可為字串或 { message } 物件；讀不到清單就只顯示 message。
import { apiRequest, ApiError } from "@/lib/queryClient";
import type { Game } from "@shared/schema";

export interface PublishErrorInfo {
  /** 主要錯誤訊息（ApiError 已解析後端 message） */
  message: string;
  /** 不合格項目（逐條列給使用者看；可能是空陣列） */
  details: string[];
}

const ISSUE_LIST_KEYS = ["errors", "issues", "problems", "reasons"] as const;

export async function publishGame(gameId: string): Promise<Game> {
  const res = await apiRequest("POST", `/api/admin/games/${gameId}/publish`, {
    status: "published",
  });
  return res.json();
}

function issueToText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const { message } = item as { message?: unknown };
    if (typeof message === "string") return message;
  }
  return "";
}

function extractIssueMessages(body: Record<string, unknown> | null): string[] {
  if (!body) return [];
  for (const key of ISSUE_LIST_KEYS) {
    const list = body[key];
    if (Array.isArray(list)) return list.map(issueToText).filter((text) => text.length > 0);
  }
  return [];
}

export function describePublishError(error: unknown): PublishErrorInfo {
  const message =
    error instanceof Error && error.message ? error.message : "發布失敗，請稍後再試";
  const body = error instanceof ApiError ? error.body : null;
  return { message, details: extractIssueMessages(body) };
}
