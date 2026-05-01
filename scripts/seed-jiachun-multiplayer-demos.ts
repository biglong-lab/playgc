// 🏯 賈村 6 個多人示範遊戲 一次性 seed script
//
// 用途：把 JIACHUN_MODULES 的 6 個模組批次套用到 DB（建立 game + pages），
// 不必 admin 手動點 6 次。
//
// 執行方式（需在有 .env 的環境）：
//   npm run seed:jiachun
//
// 或 production：
//   docker exec gamehomicc-app-1 npm run seed:jiachun
//
// 特性：
// - 跳過已存在的 module（依 module.id 對應 games.title 比對）— 可重複執行
// - 自動取 JIACHUN 場域的 fieldId
// - 沿用 admin-modules.ts 的 createGame + createPage 邏輯

import { db } from "../server/db";
import { games, pages, fields } from "../shared/schema";
import { JIACHUN_MODULES } from "../shared/schema/modules/jiachun";
import { generateSlug } from "../server/qrCodeService";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function main() {
  console.log("🏯 賈村 6 個多人示範遊戲 seed 開始");

  // 1. 取 JIACHUN 場域 id
  const [jiachunField] = await db
    .select()
    .from(fields)
    .where(eq(fields.code, "JIACHUN"))
    .limit(1);

  if (!jiachunField) {
    console.error("❌ 找不到 code='JIACHUN' 的場域");
    process.exit(1);
  }

  console.log(`✓ 找到 JIACHUN 場域：${jiachunField.id}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const moduleData of JIACHUN_MODULES) {
    // 防重：依 title 比對（避免重複建相同遊戲）
    const existing = await db
      .select()
      .from(games)
      .where(eq(games.title, moduleData.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  跳過 ${moduleData.name}（已存在）`);
      skippedCount++;
      continue;
    }

    const slug = generateSlug();

    // 建 game
    const [game] = await db
      .insert(games)
      .values({
        title: moduleData.name,
        description: moduleData.description,
        fieldId: jiachunField.id,
        publicSlug: slug,
        creatorId: null,
        difficulty: moduleData.difficulty,
        estimatedTime: moduleData.estimatedTime,
        maxPlayers: moduleData.maxPlayers,
        gameMode: moduleData.gameMode ?? "individual",
        status: "published", // 直接發布（demo 用）
      })
      .returning();

    // 建 pages
    if (moduleData.pages.length > 0) {
      for (let i = 0; i < moduleData.pages.length; i++) {
        const templatePage = moduleData.pages[i];
        await db.insert(pages).values({
          id: randomUUID(),
          gameId: game.id,
          pageType: templatePage.pageType,
          pageOrder: i + 1,
          customName: templatePage.title,
          config: templatePage.config,
        });
      }
    }

    console.log(
      `✅ 建立 ${moduleData.name}（${moduleData.pages.length} 頁，slug=${slug}）`,
    );
    createdCount++;
  }

  console.log(
    `\n🎉 完成：建立 ${createdCount} 個遊戲，跳過 ${skippedCount} 個（已存在）`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed 失敗：", err);
  process.exit(1);
});
