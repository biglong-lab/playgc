// 修補 jiachun-defense-battle 遊戲：補齊碎片 2-5 的發放
//
// 問題：原 importJiachunGame.ts 只有 page 8（關公廟）會發碎片 1（itemId=13），
// 碎片 2-5（itemId=14,15,16,17）完全沒有 page 會發，導致玩家到 page 12
// 「組合情報」永遠收不滿 5 個碎片，100% 卡關。
//
// 修復：用 onCompleteActions.add_item 把碎片獎勵掛到既有的 pages：
//   page 4  歸零靶場        → 暫掛碎片 2（歷史上從隧道出口獲得）
//   page 6  射擊訓練        → 暫掛碎片 3（手榴彈區）
//   page 9  化學武器防護    → 暫掛碎片 4（六號樓）
//   page 10 防護知識測驗    → 暫掛碎片 5（夜間巡邏）
//
// 這不是劇情最理想的對應（本來對應地點是隧道/手榴彈/六號樓/巡邏），
// 但至少能讓遊戲通關。未來可補新 pages 讓劇情連貫。

import { db } from "../db";
import { pages } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const GAME_ID = "jiachun-defense-battle";

// pageOrder → 要補的 add_item 碎片 itemId（字串，與前端 inventory 相容）
const FRAGMENT_ASSIGNMENTS: Array<{ pageOrder: number; itemId: string; note: string }> = [
  { pageOrder: 4, itemId: "14", note: "補：碎片 2/5（原設計在隧道出口）" },
  { pageOrder: 6, itemId: "15", note: "補：碎片 3/5（原設計在手榴彈區）" },
  { pageOrder: 9, itemId: "16", note: "補：碎片 4/5（原設計在六號樓）" },
  { pageOrder: 10, itemId: "17", note: "補：碎片 5/5（原設計在夜間巡邏）" },
];

interface OnCompleteAction {
  type: string;
  itemId?: string;
  [key: string]: unknown;
}

async function fixJiachunFragments() {
  console.log(`[fix] 開始修補 ${GAME_ID} 的碎片發放...`);

  for (const assignment of FRAGMENT_ASSIGNMENTS) {
    const existing = await db
      .select()
      .from(pages)
      .where(and(
        eq(pages.gameId, GAME_ID),
        eq(pages.pageOrder, assignment.pageOrder),
      ));

    if (existing.length === 0) {
      console.warn(`[fix] page ${assignment.pageOrder} 不存在，跳過`);
      continue;
    }

    const page = existing[0];
    const config = (page.config ?? {}) as Record<string, unknown>;
    const existingActions = (config.onCompleteActions as OnCompleteAction[] | undefined) ?? [];

    // 冪等：若已有這個 add_item action 就跳過
    const alreadyHas = existingActions.some(
      (a) => a.type === "add_item" && String(a.itemId) === assignment.itemId,
    );
    if (alreadyHas) {
      console.log(`[fix] page ${assignment.pageOrder} 已有碎片 ${assignment.itemId}，跳過`);
      continue;
    }

    const newActions: OnCompleteAction[] = [
      ...existingActions,
      { type: "add_item", itemId: assignment.itemId },
    ];

    await db
      .update(pages)
      .set({
        config: { ...config, onCompleteActions: newActions },
      })
      .where(eq(pages.id, page.id));

    console.log(`[fix] ✅ page ${assignment.pageOrder}: ${assignment.note}`);
  }

  console.log(`[fix] 完成！`);
}

fixJiachunFragments()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fix] 失敗:", err);
    process.exit(1);
  });
