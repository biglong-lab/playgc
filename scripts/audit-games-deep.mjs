#!/usr/bin/env node
/** 深度靜態分析：檢查每一頁 config 必填欄位是否齊全 */
import pg from "pg";
const client = new pg.Client("postgresql://postgres:postgres@localhost:5437/gameplatform");
await client.connect();

const { rows: games } = await client.query(
  "SELECT id, title, status FROM games ORDER BY created_at",
);

const gameReports = [];

for (const game of games) {
  const { rows: pages } = await client.query(
    "SELECT id, page_order, page_type, config FROM pages WHERE game_id=$1 ORDER BY page_order",
    [game.id],
  );

  const issues = [];
  const locationsVisited = new Set();
  const locationsNeeded = new Map();

  for (const p of pages) {
    const c = p.config || {};
    const label = `[${p.page_order}] ${p.page_type}`;

    switch (p.page_type) {
      case "text_card":
      case "dialogue":
        // 必須有 text 或 messages
        if (!c.text && !c.content && !(c.messages && c.messages.length))
          issues.push(`⚠️ ${label} 無 text/content/messages（玩家看空白）`);
        break;

      case "video":
        if (!c.videoUrl) issues.push(`⚠️ ${label} videoUrl 未設定`);
        if (c.forceWatch && c.skipEnabled === false && c.autoCompleteOnEnd === false)
          issues.push(`🔴 ${label} forceWatch+不可 skip+不自動過 → 玩家卡死`);
        break;

      case "button":
        if (!c.buttons || c.buttons.length === 0)
          issues.push(`🔴 ${label} 無 buttons（會顯示 fallback 但流程異常）`);
        else {
          c.buttons.forEach((b, i) => {
            if (!b.text) issues.push(`⚠️ ${label} button[${i}] 無文字`);
          });
        }
        break;

      case "text_verify":
        if (!c.question) issues.push(`⚠️ ${label} 無 question`);
        if (!c.correctAnswer && !(c.answers && c.answers.length) && !c.aiScoring)
          issues.push(`🔴 ${label} 無 correctAnswer / answers 也未開 AI 評分 → 永遠答不對`);
        break;

      case "choice_verify": {
        const isQuiz = c.questions && c.questions.length > 0;
        if (isQuiz) {
          c.questions.forEach((q, i) => {
            if (!q.question || !q.options || q.options.length < 2)
              issues.push(`⚠️ ${label} question[${i}] 不完整`);
            if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options?.length)
              issues.push(`🔴 ${label} question[${i}] correctAnswer 索引錯誤`);
          });
        } else if (!c.options || c.options.length === 0) {
          issues.push(`🔴 ${label} 無 options 和 questions → 無法作答`);
        } else if (!c.options.some((o) => o.correct)) {
          issues.push(`🔴 ${label} 無任何 correct 選項 → 永遠答不對`);
        }
        break;
      }

      case "conditional_verify":
        if ((!c.conditions || c.conditions.length === 0) && (!c.fragments || c.fragments.length === 0)) {
          issues.push(`🔴 ${label} 無 conditions 也無 fragments → 邏輯不完整`);
        }
        break;

      case "qr_scan":
        if (!c.qrCodeId && !c.primaryCode && !c.expectedCode && !(c.acceptedCodes?.length)) {
          issues.push(`🔴 ${label} 無 qrCodeId/primaryCode/expectedCode → 驗證不了`);
        }
        if (c.locationId) locationsVisited.add(String(c.locationId));
        break;

      case "lock":
        if (!c.combination) issues.push(`🔴 ${label} 無 combination → 無解`);
        break;

      case "gps_mission": {
        const hasTarget = (c.targetLocation?.lat != null) || c.targetLatitude != null;
        if (!hasTarget) issues.push(`🔴 ${label} 無目標座標 → 遊戲無法判定到達`);
        if (c.locationId) locationsVisited.add(String(c.locationId));
        break;
      }

      case "motion_challenge":
        if (!c.challengeType) issues.push(`⚠️ ${label} 無 challengeType（用預設 shake）`);
        break;

      case "shooting_mission":
        if (!c.requiredHits && !c.targetScore) issues.push(`⚠️ ${label} 無 requiredHits / targetScore`);
        break;

      case "time_bomb":
        if (!c.tasks || c.tasks.length === 0) {
          issues.push(`🟡 ${label} 無 tasks（會走 fallback 自動過關，但體驗不佳）`);
        }
        if (!c.timeLimit) issues.push(`⚠️ ${label} 無 timeLimit`);
        break;

      case "vote":
        if (!c.options || c.options.length < 2) issues.push(`🔴 ${label} 投票選項少於 2 個`);
        if (!c.question) issues.push(`⚠️ ${label} 無 question`);
        break;

      case "flow_router":
        if (!c.routes || c.routes.length === 0) {
          if (!c.defaultNextPageId) issues.push(`🔴 ${label} 無 routes 也無 defaultNextPageId`);
        }
        break;

      case "photo_mission":
        if (c.aiVerify && (!c.targetKeywords || !c.targetKeywords.length))
          issues.push(`🔴 ${label} 開 aiVerify 但 targetKeywords 空 → AI 不知道要驗什麼`);
        break;
    }

    // visited_location 需要的 location
    if (p.page_type === "conditional_verify" && Array.isArray(c.conditions)) {
      for (const cond of c.conditions) {
        if (cond.type === "visited_location" && cond.locationId) {
          const id = String(cond.locationId);
          if (!locationsNeeded.has(id)) locationsNeeded.set(id, []);
          locationsNeeded.get(id).push(label);
        }
      }
    }
  }

  // visited_location 依賴驗證
  for (const [locId, needs] of locationsNeeded) {
    if (!locationsVisited.has(locId)) {
      issues.push(`🔴 需要造訪 location '${locId}' 但沒有 QR/GPS 頁面可完成（${needs.join(", ")}）`);
    }
  }

  gameReports.push({ game, issues, pagesCount: pages.length });
}

// 輸出
console.log("\n" + "=".repeat(70));
console.log("  遊戲深度盤點報告");
console.log("=".repeat(70));

let critical = 0, warnings = 0, infos = 0;
for (const { game, issues, pagesCount } of gameReports) {
  const status = issues.length === 0 ? "🟢" : issues.some((i) => i.startsWith("🔴")) ? "🔴" : "🟡";
  console.log(`\n${status} ${game.title} (${game.status}) — ${pagesCount} 頁`);
  if (issues.length === 0) {
    console.log(`   ✅ 配置完整`);
  } else {
    issues.forEach((i) => {
      console.log(`   ${i}`);
      if (i.startsWith("🔴")) critical++;
      else if (i.startsWith("⚠️")) warnings++;
      else infos++;
    });
  }
}

console.log("\n" + "=".repeat(70));
console.log(`  🔴 嚴重：${critical}  ⚠️  警告：${warnings}  🟡 提示：${infos}`);
console.log("=".repeat(70) + "\n");

await client.end();
