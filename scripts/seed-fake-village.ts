// 賈村戰技體驗場 — 遊戲種子資料
// 使用方式: npx tsx scripts/seed-fake-village.ts
// 建立個人版 + 團隊版遊戲，含 6 章節、29+ 頁面、4 道具
import { db } from "../server/db";
import {
  games,
  pages,
  items,
  gameChapters,
  fields,
} from "@shared/schema";
import { randomUUID } from "crypto";

import {
  CHAPTER_DEFS,
  GAME_ITEMS,
  buildTeamChapterDefs,
} from "./seed-data/fake-village-data";
import type { ChapterDef } from "./seed-data/fake-village-data";

// ============================================================================
// 輔助函式 — 建立章節與頁面
// ============================================================================

async function createChaptersAndPages(gameId: string, chapters: ChapterDef[]) {
  let globalPageOrder = 1;

  for (const ch of chapters) {
    const chapterId = randomUUID();
    await db.insert(gameChapters).values({
      id: chapterId,
      gameId,
      chapterOrder: ch.order,
      title: ch.title,
      description: ch.desc,
      unlockType: ch.unlockType,
      unlockConfig: ch.unlockConfig,
      estimatedTime: ch.time,
      status: "published",
    });

    for (const page of ch.chPages) {
      await db.insert(pages).values({
        id: randomUUID(),
        gameId,
        pageOrder: globalPageOrder++,
        pageType: page.pageType,
        config: page.config,
        chapterId,
      });
    }

    console.log(`  ✅ 第 ${ch.order} 章「${ch.title}」(${ch.chPages.length} 頁, ${ch.unlockType})`);
  }
}

// ============================================================================
// 建立道具
// ============================================================================

async function createItems(gameId: string) {
  for (const item of GAME_ITEMS) {
    await db.insert(items).values({
      id: randomUUID(),
      gameId,
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      effect: item.effect,
    });
  }
  console.log(`  ✅ ${GAME_ITEMS.length} 個道具已建立`);
}

// ============================================================================
// 主函式
// ============================================================================

async function seedFakeVillageGame() {
  console.log("\n" + "=".repeat(60));
  console.log("🏰 賈村戰技體驗場 — 遊戲種子資料建立");
  console.log("=".repeat(60));

  // 取得現有場域
  const existingFields = await db.select().from(fields).limit(1);
  if (existingFields.length === 0) {
    console.error("❌ 找不到場域資料，請先執行 npx tsx scripts/seed.ts");
    process.exit(1);
  }
  const fieldId = existingFields[0].id;
  console.log(`\n📍 使用場域: ${existingFields[0].name} (${fieldId})`);

  // ---- 建立個人版遊戲 ----
  console.log("\n🎮 建立個人版遊戲...");
  const soloGameId = randomUUID();
  await db.insert(games).values({
    id: soloGameId,
    title: "賈村戰技體驗場 — 軍事冒險大作戰",
    description:
      "化身新兵，在金門盤山訓練場接受軍事挑戰！打靶、投擲手榴彈、探索坑道、答題賺分，" +
      "還能「賭一把」翻倍點數！累積點數兌換飲料！",
    difficulty: "medium",
    estimatedTime: 40,
    maxPlayers: 30,
    fieldId,
    gameMode: "individual",
    gameStructure: "chapters",
    chapterUnlockMode: "all_open",
    allowChapterReplay: true,
    status: "published",
    publicSlug: "fake-village-solo",
    creatorId: null,
  });
  console.log("  ✅ 個人版遊戲已建立 (slug: fake-village-solo)");

  console.log("\n🎒 建立遊戲道具...");
  await createItems(soloGameId);

  console.log("\n📚 建立章節與頁面...");
  await createChaptersAndPages(soloGameId, CHAPTER_DEFS);

  // ---- 建立團隊版遊戲 ----
  console.log("\n\n🤝 建立團隊版遊戲...");
  const teamGameId = randomUUID();
  await db.insert(games).values({
    id: teamGameId,
    title: "賈村戰技體驗場 — 團隊合作戰",
    description:
      "組隊挑戰！2-5 人一組，共同完成軍事訓練任務。團隊投票決策、共享點數、協力闖關！" +
      "累積點數兌換飲料！",
    difficulty: "medium",
    estimatedTime: 45,
    maxPlayers: 30,
    fieldId,
    gameMode: "team",
    gameStructure: "chapters",
    chapterUnlockMode: "all_open",
    allowChapterReplay: true,
    minTeamPlayers: 2,
    maxTeamPlayers: 5,
    enableTeamChat: true,
    enableTeamLocation: true,
    teamScoreMode: "shared",
    status: "published",
    publicSlug: "fake-village-team",
    creatorId: null,
  });
  console.log("  ✅ 團隊版遊戲已建立 (slug: fake-village-team)");

  await createItems(teamGameId);

  console.log("\n📚 建立團隊版章節與頁面...");
  await createChaptersAndPages(teamGameId, buildTeamChapterDefs());

  // ---- 完成 ----
  console.log("\n" + "=".repeat(60));
  console.log("🎉 賈村戰技體驗場遊戲建立完成！");
  console.log("=".repeat(60));
  console.log("\n📋 遊戲資訊：");
  console.log("  個人版: http://localhost:3333/g/fake-village-solo");
  console.log("  團隊版: http://localhost:3333/g/fake-village-team");
  console.log("\n🎮 或從首頁 http://localhost:3333/home 進入\n");

  process.exit(0);
}

// ============================================================================
// 執行
// ============================================================================

seedFakeVillageGame().catch((err) => {
  console.error("❌ 種子資料建立失敗:", err);
  process.exit(1);
});
