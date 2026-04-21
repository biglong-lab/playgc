// 📚 章節模板服務 — 跨遊戲章節重用（Option A: Template 複製模式）
//
// 用途：
//   - 管理員把「運作良好的章節」存成場域模板
//   - 其他遊戲可從模板一鍵匯入（複製章節 + 其下 pages）
//   - 匯入後是獨立副本，可個別修改，不會反向影響模板
//
// 匯入時風險處理：
//   Pages config 內常見 game-specific 引用：
//     - locationId (location:uuid)
//     - itemId (item:uuid or item:slug)
//     - chapterId (page 間跳轉)
//   匯入時自動偵測並標記 needsReconfigure，管理員可看到「哪些 pages 要重設」。

import { and, eq, asc, desc } from "drizzle-orm";
import { db } from "../db";
import {
  chapterTemplates,
  gameChapters,
  pages,
  items,
  locations,
  achievements,
  type ChapterTemplate,
  type InsertChapterTemplate,
  type ChapterTemplatePageSnapshot,
  type GameChapter,
  type Page,
} from "@shared/schema";

// ============================================================================
// 偵測 config 內的 game-specific 引用
// ============================================================================

/**
 * 掃描 page config 內的 game-specific 欄位，列出所有引用
 */
function detectReferences(config: Record<string, unknown>): ChapterTemplatePageSnapshot["references"] {
  const refs: Array<{
    type: "location" | "item" | "achievement" | "chapter";
    id: string;
    slug?: string;
  }> = [];

  // locationId（可能是 string 或 number）
  const locationId = config.locationId ?? config.location_id;
  if (locationId != null && locationId !== "") {
    refs.push({ type: "location", id: String(locationId) });
  }

  // itemId
  const itemId = config.itemId ?? config.item_id;
  if (itemId != null && itemId !== "") {
    refs.push({ type: "item", id: String(itemId) });
  }

  // itemIds (array)
  if (Array.isArray(config.itemIds)) {
    for (const id of config.itemIds) {
      if (id != null && id !== "") {
        refs.push({ type: "item", id: String(id) });
      }
    }
  }

  // buttons (Button config 內也可能有 items)
  if (Array.isArray(config.buttons)) {
    for (const btn of config.buttons as Array<Record<string, unknown>>) {
      if (Array.isArray(btn.items)) {
        for (const id of btn.items) {
          if (id != null && id !== "") {
            refs.push({ type: "item", id: String(id) });
          }
        }
      }
      if (btn.nextPageId) {
        // page 間跳轉不算 game-specific，因為模板內 page 會重新生成
      }
    }
  }

  // chapter jumps
  if (config.nextChapterId) {
    refs.push({ type: "chapter", id: String(config.nextChapterId) });
  }

  return refs.length > 0 ? refs : undefined;
}

/**
 * 幫 references 加上 slug（從對應表查）— 用於匯入時比對
 * 支援：items / locations / achievements
 */
async function enrichReferencesWithSlug(
  references: NonNullable<ChapterTemplatePageSnapshot["references"]>,
  gameId: string,
): Promise<NonNullable<ChapterTemplatePageSnapshot["references"]>> {
  // 並行撈三個表的 slug 對應
  const [gameItems, gameLocations, gameAchievements] = await Promise.all([
    references.some((r) => r.type === "item")
      ? db.select().from(items).where(eq(items.gameId, gameId))
      : Promise.resolve([] as Array<{ id: string; slug: string | null }>),
    references.some((r) => r.type === "location")
      ? db.select().from(locations).where(eq(locations.gameId, gameId))
      : Promise.resolve([] as Array<{ id: number; slug: string | null }>),
    references.some((r) => r.type === "achievement")
      ? db.select().from(achievements).where(eq(achievements.gameId, gameId))
      : Promise.resolve([] as Array<{ id: number; slug: string | null }>),
  ]);

  const itemIdToSlug = new Map<string, string>();
  for (const it of gameItems) {
    if (it.slug) itemIdToSlug.set(String(it.id), it.slug);
  }
  const locationIdToSlug = new Map<string, string>();
  for (const loc of gameLocations) {
    if (loc.slug) locationIdToSlug.set(String(loc.id), loc.slug);
  }
  const achievementIdToSlug = new Map<string, string>();
  for (const ach of gameAchievements) {
    if (ach.slug) achievementIdToSlug.set(String(ach.id), ach.slug);
  }

  return references.map((r) => {
    if (r.type === "item" && itemIdToSlug.has(r.id)) {
      return { ...r, slug: itemIdToSlug.get(r.id) };
    }
    if (r.type === "location" && locationIdToSlug.has(r.id)) {
      return { ...r, slug: locationIdToSlug.get(r.id) };
    }
    if (r.type === "achievement" && achievementIdToSlug.has(r.id)) {
      return { ...r, slug: achievementIdToSlug.get(r.id) };
    }
    return r;
  });
}

// ============================================================================
// 存成模板 — 從現有 game_chapters 建立
// ============================================================================

export interface SaveAsTemplateInput {
  fieldId: string;
  chapterId: string;
  /** admin_accounts.id — 建立者 */
  createdBy?: string;
  /** 覆寫標題（預設用原章節 title） */
  title?: string;
  description?: string;
  category?: string;
}

export async function saveChapterAsTemplate(
  input: SaveAsTemplateInput,
): Promise<ChapterTemplate> {
  const [chapter] = await db
    .select()
    .from(gameChapters)
    .where(eq(gameChapters.id, input.chapterId));
  if (!chapter) throw new Error("章節不存在");

  // 取得該章節下所有 pages
  const chapterPages = await db
    .select()
    .from(pages)
    .where(eq(pages.chapterId, input.chapterId))
    .orderBy(asc(pages.pageOrder));

  // 製作 snapshot — 偵測 game-specific 引用
  const snapshots: ChapterTemplatePageSnapshot[] = [];
  for (const p of chapterPages) {
    const config = (p.config as Record<string, unknown>) || {};
    const rawRefs = detectReferences(config);
    const references = rawRefs
      ? await enrichReferencesWithSlug(rawRefs, chapter.gameId)
      : undefined;

    snapshots.push({
      pageOrder: p.pageOrder,
      pageType: p.pageType,
      config,
      needsReconfigure: references != null && references.length > 0,
      references,
    });
  }

  const toInsert: InsertChapterTemplate = {
    fieldId: input.fieldId,
    title: input.title ?? chapter.title,
    description: input.description ?? chapter.description ?? null,
    coverImageUrl: chapter.coverImageUrl ?? null,
    category: input.category ?? null,
    estimatedTime: chapter.estimatedTime ?? null,
    unlockType: chapter.unlockType ?? "complete_previous",
    unlockConfig: chapter.unlockConfig ?? {},
    pagesSnapshot: snapshots,
    sourceChapterId: chapter.id,
    sourceGameId: chapter.gameId,
    createdBy: input.createdBy ?? null,
  };

  const [template] = await db
    .insert(chapterTemplates)
    .values(toInsert)
    .returning();
  return template;
}

// ============================================================================
// 列出場域的所有模板
// ============================================================================

export async function listChapterTemplates(
  fieldId: string,
  options: { category?: string } = {},
): Promise<ChapterTemplate[]> {
  const conditions = [eq(chapterTemplates.fieldId, fieldId)];
  if (options.category) {
    conditions.push(eq(chapterTemplates.category, options.category));
  }
  return db
    .select()
    .from(chapterTemplates)
    .where(and(...conditions))
    .orderBy(desc(chapterTemplates.updatedAt));
}

// ============================================================================
// 從模板匯入 — 建立章節 + 所有 pages（per-game 獨立副本）
// ============================================================================

export interface ImportTemplateInput {
  templateId: string;
  targetGameId: string;
  /** 起始排序（預設：現有章節 + 1） */
  chapterOrder?: number;
  /** 匯入時是否嘗試用 slug 對應目標遊戲的 items（預設 true） */
  remapItemsBySlug?: boolean;
}

export interface ImportTemplateResult {
  chapter: GameChapter;
  pagesCreated: Page[];
  /** 匯入時仍需要手動重設的 pages（有 game-specific 引用但無法自動對應） */
  needsManualReconfigure: Array<{
    pageId: string;
    pageOrder: number;
    missingReferences: Array<{ type: string; id: string; slug?: string }>;
  }>;
}

export async function importChapterFromTemplate(
  input: ImportTemplateInput,
): Promise<ImportTemplateResult> {
  const [template] = await db
    .select()
    .from(chapterTemplates)
    .where(eq(chapterTemplates.id, input.templateId));
  if (!template) throw new Error("模板不存在");

  // 決定 chapterOrder
  const existingChapters = await db
    .select()
    .from(gameChapters)
    .where(eq(gameChapters.gameId, input.targetGameId));
  const nextOrder = input.chapterOrder ?? existingChapters.length + 1;

  // 匯入章節
  const [newChapter] = await db
    .insert(gameChapters)
    .values({
      gameId: input.targetGameId,
      chapterOrder: nextOrder,
      title: template.title,
      description: template.description,
      coverImageUrl: template.coverImageUrl,
      estimatedTime: template.estimatedTime,
      unlockType: template.unlockType,
      unlockConfig: template.unlockConfig,
      status: "draft",
      sourceTemplateId: template.id,
    })
    .returning();

  // 預先抓目標遊戲的 slug → id 對應（用來 remap 引用）
  const remap = input.remapItemsBySlug ?? true;
  const [targetItems, targetLocations, targetAchievements] = remap
    ? await Promise.all([
        db.select().from(items).where(eq(items.gameId, input.targetGameId)),
        db.select().from(locations).where(eq(locations.gameId, input.targetGameId)),
        db.select().from(achievements).where(eq(achievements.gameId, input.targetGameId)),
      ])
    : [[], [], []] as const;

  const itemSlugToId = new Map<string, string>();
  for (const it of targetItems) {
    if (it.slug) itemSlugToId.set(it.slug, it.id);
  }
  const locationSlugToId = new Map<string, number>();
  for (const loc of targetLocations) {
    if (loc.slug) locationSlugToId.set(loc.slug, loc.id);
  }
  const achievementSlugToId = new Map<string, number>();
  for (const ach of targetAchievements) {
    if (ach.slug) achievementSlugToId.set(ach.slug, ach.id);
  }

  // 匯入 pages
  const snapshots = (template.pagesSnapshot as ChapterTemplatePageSnapshot[]) || [];
  const pagesCreated: Page[] = [];
  const needsManual: ImportTemplateResult["needsManualReconfigure"] = [];

  for (const snap of snapshots) {
    const newConfig = { ...snap.config };
    let stillNeedsReconfigure = false;
    const missingRefs: Array<{ type: string; id: string; slug?: string }> = [];

    // 嘗試對應 引用（若有 slug 且目標遊戲有對應）
    if (remap && snap.references) {
      for (const ref of snap.references) {
        // --- item ---
        if (ref.type === "item" && ref.slug && itemSlugToId.has(ref.slug)) {
          const newItemId = itemSlugToId.get(ref.slug)!;
          if (newConfig.itemId === ref.id) newConfig.itemId = newItemId;
          if (newConfig.item_id === ref.id) newConfig.item_id = newItemId;
          if (Array.isArray(newConfig.itemIds)) {
            newConfig.itemIds = (newConfig.itemIds as string[]).map((id) =>
              id === ref.id ? newItemId : id,
            );
          }
          if (Array.isArray(newConfig.buttons)) {
            newConfig.buttons = (newConfig.buttons as Array<Record<string, unknown>>).map(
              (btn) => {
                if (Array.isArray(btn.items)) {
                  return {
                    ...btn,
                    items: (btn.items as string[]).map((id) =>
                      id === ref.id ? newItemId : id,
                    ),
                  };
                }
                return btn;
              },
            );
          }
        }
        // --- location ---
        else if (ref.type === "location" && ref.slug && locationSlugToId.has(ref.slug)) {
          const newLocId = locationSlugToId.get(ref.slug)!;
          if (String(newConfig.locationId) === ref.id) newConfig.locationId = newLocId;
          if (String(newConfig.location_id) === ref.id) newConfig.location_id = newLocId;
        }
        // --- achievement ---
        else if (ref.type === "achievement" && ref.slug && achievementSlugToId.has(ref.slug)) {
          const newAchId = achievementSlugToId.get(ref.slug)!;
          if (String(newConfig.achievementId) === ref.id) newConfig.achievementId = newAchId;
          if (String(newConfig.achievement_id) === ref.id) newConfig.achievement_id = newAchId;
        }
        // --- chapter 跨遊戲不對應（不同故事線）---
        else if (ref.type === "chapter") {
          stillNeedsReconfigure = true;
          missingRefs.push(ref);
        }
        // --- 沒 slug 或目標遊戲沒對應 → 標記 ---
        else {
          stillNeedsReconfigure = true;
          missingRefs.push(ref);
        }
      }
    } else if (snap.needsReconfigure) {
      stillNeedsReconfigure = true;
      if (snap.references) {
        missingRefs.push(...snap.references);
      }
    }

    const [newPage] = await db
      .insert(pages)
      .values({
        gameId: input.targetGameId,
        chapterId: newChapter.id,
        pageOrder: snap.pageOrder,
        pageType: snap.pageType,
        config: newConfig,
      })
      .returning();
    pagesCreated.push(newPage);

    if (stillNeedsReconfigure) {
      needsManual.push({
        pageId: newPage.id,
        pageOrder: newPage.pageOrder,
        missingReferences: missingRefs,
      });
    }
  }

  return { chapter: newChapter, pagesCreated, needsManualReconfigure: needsManual };
}

// ============================================================================
// 刪除模板
// ============================================================================

export async function deleteChapterTemplate(id: string): Promise<void> {
  await db.delete(chapterTemplates).where(eq(chapterTemplates.id, id));
}

// ============================================================================
// 更新模板（metadata only；pages 須重新「存成模板」）
// ============================================================================

export async function updateChapterTemplateMeta(
  id: string,
  data: Partial<Pick<InsertChapterTemplate, "title" | "description" | "category" | "coverImageUrl">>,
): Promise<ChapterTemplate | undefined> {
  const [updated] = await db
    .update(chapterTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chapterTemplates.id, id))
    .returning();
  return updated;
}
