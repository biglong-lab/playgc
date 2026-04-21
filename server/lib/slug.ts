// 🏷️ Slug 工具 — 從名稱自動生成 URL/識別安全的 slug
//
// 用途：
//   - items 表 slug 欄位（game_id 下唯一）
//   - 其他實體（chapters、achievements）未來若也要支援 slug 可重用
//
// 規則：
//   - 中文保留（因遊戲內容大多中文，強制轉拼音反而不易識別）
//   - 英文轉小寫
//   - 空白 → 底線
//   - 特殊符號去除（保留字母、數字、中文、底線）
//   - 最多 50 字元
//   - 空值 fallback → "item"
import { and, eq, isNotNull } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "../db";

/**
 * 將名稱轉為 slug（純字串轉換，不做唯一性檢查）
 */
export function nameToSlug(name: string): string {
  if (!name) return "item";
  const cleaned = name
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .substring(0, 50);
  return cleaned || "item";
}

/**
 * 標準化使用者輸入的 slug（去除多餘空白、特殊字元）
 * 若留空或轉換後為空，回傳 null（由 caller 決定是否自動生成）
 */
export function normalizeSlugInput(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .substring(0, 50);
  return cleaned || null;
}

/**
 * 確保 slug 在指定 scope 下唯一，若衝突則加 _2 / _3 後綴
 *
 * 注意：為避開 drizzle generic 型別地雷，table 傳 any，由 caller 確保型別正確。
 *
 * @param table drizzle table
 * @param slugColumn slug 欄位
 * @param scopeColumn scope 欄位（例 gameId）
 * @param scopeValue scope 值
 * @param baseSlug 候選 slug（會自動 normalize）
 * @param excludeId 更新時排除自己的 ID
 */
export async function ensureUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic 複雜
  table: any,
  slugColumn: PgColumn,
  scopeColumn: PgColumn,
  scopeValue: string,
  baseSlug: string,
  excludeId?: { column: PgColumn; value: string },
): Promise<string> {
  const base = nameToSlug(baseSlug);
  let candidate = base;
  let counter = 2;

  // 抓 scope 下所有已用 slug
  const rows = await db
    .select({ slug: slugColumn })
    .from(table)
    .where(
      and(
        eq(scopeColumn, scopeValue),
        isNotNull(slugColumn),
      ),
    );
  const used = new Set(
    (rows as Array<{ slug: string | null }>)
      .map((r) => r.slug)
      .filter((s): s is string => !!s),
  );

  // 若是更新，排除自己當前的 slug（避免自己衝自己）
  if (excludeId) {
    const ownRows = await db
      .select({ slug: slugColumn })
      .from(table)
      .where(eq(excludeId.column, excludeId.value));
    const ownSlug = (ownRows[0] as { slug: string | null } | undefined)?.slug;
    if (ownSlug) used.delete(ownSlug);
  }

  while (used.has(candidate)) {
    candidate = `${base}_${counter}`;
    counter++;
  }
  return candidate;
}
