// 編輯器草稿 — 「目前編輯內容」與「上次儲存內容」的比對基準
//
// 用途：判斷編輯器是否有未儲存變更（離開攔截、預覽前自動儲存）
// 做法：把可存欄位序列化成穩定字串比較（物件鍵排序，避免鍵順序不同被誤判為有變更）
import type { GameWithDetails, Page } from "@shared/schema";

export interface EditorDraft {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: number;
  maxPlayers: number;
  bgmUrl: string;
  bgmVolume: number;
  pages: Page[];
}

/** 新遊戲的預設值（也是編輯器 useState 的初始值，兩者必須同源） */
export const EMPTY_EDITOR_DRAFT: EditorDraft = {
  title: "",
  description: "",
  difficulty: "medium",
  estimatedTime: 30,
  maxPlayers: 6,
  bgmUrl: "",
  bgmVolume: 50,
  pages: [],
};

/** 由伺服器遊戲資料推出編輯器欄位值（載入與比對基準共用同一套轉換） */
export function draftFromGame(game: GameWithDetails): EditorDraft {
  const extra = game as { bgmUrl?: string | null; bgmVolume?: number | null };
  return {
    title: game.title,
    description: game.description || "",
    difficulty: game.difficulty || "medium",
    estimatedTime: game.estimatedTime || 30,
    maxPlayers: game.maxPlayers || 6,
    bgmUrl: extra.bgmUrl ?? "",
    bgmVolume: extra.bgmVolume ?? 50,
    pages: game.pages || [],
  };
}

/** 儲存 API 的 payload（新遊戲預設草稿；已存在的遊戲不動 status，避免已發布被降級） */
export function buildSavePayload(draft: EditorDraft, isNew: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: draft.title,
    description: draft.description,
    difficulty: draft.difficulty,
    estimatedTime: draft.estimatedTime,
    maxPlayers: draft.maxPlayers,
    bgmUrl: draft.bgmUrl || null,
    bgmVolume: draft.bgmVolume,
  };
  if (isNew) payload.status = "draft";
  return payload;
}

/** JSON 序列化時把物件鍵排序，確保同內容 → 同字串 */
function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(source).sort().map((k) => [k, source[k]]));
}

/** 草稿 → 穩定字串（只取會被儲存的頁面欄位，忽略 createdAt 等伺服器欄位） */
export function serializeEditorDraft(draft: EditorDraft): string {
  const pages = draft.pages.map((p) => ({
    id: p.id,
    pageOrder: p.pageOrder,
    pageType: p.pageType,
    customName: p.customName ?? null,
    config: p.config ?? null,
  }));
  return JSON.stringify({ ...draft, pages }, sortKeysReplacer);
}
