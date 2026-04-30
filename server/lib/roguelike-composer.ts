// 🎲 Roguelike 模式合成器 — 從遊戲的 page pool 隨機抽組合
//
// 用途：場域累積 N 個 pages（任務點），玩家進入 roguelike 模式時
// AI/隨機從 pool 抽 6-8 個組成「個人化流程」，每次玩體驗不同。
//
// 設計：
//   - 純隨機（種子可選，方便 reproducible）
//   - 每次抽 N 個（admin 設定 targetPageCount）
//   - 篩選只有「可單獨任務」的 pageType（排除 flow_router 等需上下文的）
//   - 確保有 1 個 intro（text_card / dialogue）開頭、1 個 ending 結尾
import { db } from "../db";
import { pages, type Page } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

/** 適合在 roguelike 中當「中段任務」的 pageType */
const ROGUELIKE_TASK_TYPES = [
  "photo_spot",
  "photo_compare",
  "photo_ocr",
  "photo_mission",
  "text_verify",
  "choice_verify",
  "qr_scan",
  "shooting_mission",
  "lock",
];

/** 適合當「開場 / 結尾」的 pageType */
const INTRO_OUTRO_TYPES = ["text_card", "dialogue", "video"];

/** 不適合 roguelike（需流程上下文） */
const SKIP_TYPES = new Set(["flow_router", "conditional_verify", "photo_team", "vote"]);

export interface RoguelikeCompositionInput {
  gameId: string;
  /** 目標 page 數（預設 6） */
  targetCount?: number;
  /** 隨機種子（同 seed 給同玩家可複現） */
  seed?: number;
  /** 是否強制有 intro / outro（預設 true） */
  withIntroOutro?: boolean;
}

export interface RoguelikeCompositionResult {
  composedPages: Page[];
  totalSourcePages: number;
  /** 為什麼選這幾個（給 admin 調試用） */
  rationale: string;
}

/**
 * 簡單的種子化隨機（避免引入 lib）
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 為玩家組合一場 roguelike 流程
 */
export async function composeRoguelikeFlow(
  input: RoguelikeCompositionInput,
): Promise<RoguelikeCompositionResult> {
  const { gameId, targetCount = 6, seed = Date.now(), withIntroOutro = true } = input;

  // 取遊戲所有 pages
  const allPages = await db.select().from(pages).where(eq(pages.gameId, gameId));

  // 分類
  const introOutroPool = allPages.filter((p) => INTRO_OUTRO_TYPES.includes(p.pageType));
  const taskPool = allPages.filter(
    (p) => ROGUELIKE_TASK_TYPES.includes(p.pageType) && !SKIP_TYPES.has(p.pageType),
  );

  const rng = seededRandom(seed);
  const composed: Page[] = [];

  // 1. 開場（從 intro_outro_pool 抽 1）
  if (withIntroOutro && introOutroPool.length > 0) {
    const intro = shuffle(introOutroPool, rng)[0];
    composed.push(intro);
  }

  // 2. 中段任務
  const middleCount = withIntroOutro ? Math.max(1, targetCount - 2) : targetCount;
  const shuffledTasks = shuffle(taskPool, rng).slice(0, middleCount);
  composed.push(...shuffledTasks);

  // 3. 結尾（從 intro_outro_pool 再抽 1，避免跟 intro 重複）
  if (withIntroOutro && introOutroPool.length > 1) {
    const outroCandidates = introOutroPool.filter(
      (p) => !composed.some((c) => c.id === p.id),
    );
    if (outroCandidates.length > 0) {
      composed.push(shuffle(outroCandidates, rng)[0]);
    }
  }

  // 重排 pageOrder（按合成順序，1 開始）
  const composedPages = composed.map((p, idx) => ({
    ...p,
    pageOrder: idx + 1,
  }));

  return {
    composedPages,
    totalSourcePages: allPages.length,
    rationale: `從 ${allPages.length} 個 pages 中抽 ${composedPages.length} 個（intro=${withIntroOutro ? 1 : 0} / 任務=${middleCount} / outro=${withIntroOutro && introOutroPool.length > 1 ? 1 : 0}），seed=${seed}`,
  };
}
