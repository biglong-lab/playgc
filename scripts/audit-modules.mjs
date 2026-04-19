#!/usr/bin/env node
/**
 * 模組庫全面檢修：套用跟 audit-games-deep.mjs 同樣的規則
 * 直接 import GAME_MODULES（TS），分析每個模組的 pages 是否完備
 */
// 用 tsx register 支援 TS import
import { register } from "tsx/esm/api";
register();

const { GAME_MODULES, MODULE_CATEGORY_LABELS } = await import(
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/game-modules.ts"
);

console.log(`\n📚 模組庫檢修 — 共 ${GAME_MODULES.length} 套模組\n`);

let totalCritical = 0;
let totalWarnings = 0;
let totalInfos = 0;
const perCategory = {};

for (const mod of GAME_MODULES) {
  const issues = [];
  const pages = mod.pages || [];
  const locationsVisited = new Set();
  const locationsNeeded = new Map();
  const itemsGranted = new Set();
  const itemsNeeded = new Map();

  // 收集 page references by 位置（pages 陣列沒有 id，用 index）
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const c = p.config || {};
    const label = `[${i + 1}] ${p.pageType}`;

    switch (p.pageType) {
      case "text_card":
      case "dialogue":
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
          c.buttons.forEach((b, j) => {
            if (!b.text) issues.push(`⚠️ ${label} button[${j}] 無文字`);
          });
        }
        break;

      case "text_verify":
        if (!c.question) issues.push(`⚠️ ${label} 無 question`);
        if (!c.correctAnswer && !(c.answers && c.answers.length) && !c.aiScoring)
          issues.push(`🔴 ${label} 無 correctAnswer/answers 也未開 AI 評分 → 永遠答不對`);
        break;

      case "choice_verify": {
        const isQuiz = c.questions && c.questions.length > 0;
        if (isQuiz) {
          c.questions.forEach((q, j) => {
            if (!q.question || !q.options || q.options.length < 2)
              issues.push(`⚠️ ${label} question[${j}] 不完整`);
            if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= q.options?.length)
              issues.push(`🔴 ${label} question[${j}] correctAnswer 索引錯誤`);
          });
        } else if (!c.options || c.options.length === 0) {
          issues.push(`🔴 ${label} 無 options 和 questions → 無法作答`);
        } else {
          // 檢查新 schema（物件陣列）
          const hasObjectFormat = typeof c.options[0] === "object";
          if (hasObjectFormat) {
            if (!c.options.some((o) => o.correct)) {
              issues.push(`🔴 ${label} 無任何 correct 選項 → 永遠答不對`);
            }
          } else {
            // 舊 schema（字串陣列）
            const correctIdx = c.correctIndex;
            if (correctIdx === undefined || correctIdx < 0 || correctIdx >= c.options.length) {
              issues.push(`🔴 ${label} 舊 schema correctIndex 錯誤`);
            } else {
              issues.push(`🟡 ${label} 用舊 options 字串陣列 schema（元件有相容但建議升級）`);
            }
          }
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

      case "lock": {
        const combo = c.combination ?? c.correctCode;
        if (!combo) issues.push(`🔴 ${label} 無 combination/correctCode → 無解`);
        if (c.correctCode && !c.combination) {
          issues.push(`🟡 ${label} 用舊 correctCode schema（元件有相容但建議升級）`);
        }
        break;
      }

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
        if (!c.requiredHits && !c.targetScore) issues.push(`⚠️ ${label} 無 requiredHits/targetScore`);
        break;

      case "time_bomb":
        if (!c.tasks || c.tasks.length === 0)
          issues.push(`🟡 ${label} 無 tasks（會走 fallback 自動過關）`);
        if (!c.timeLimit) issues.push(`⚠️ ${label} 無 timeLimit`);
        break;

      case "vote":
        if (!c.options || c.options.length < 2) issues.push(`🔴 ${label} 投票選項少於 2 個`);
        if (!c.question) issues.push(`⚠️ ${label} 無 question`);
        break;

      case "flow_router":
        if ((!c.routes || c.routes.length === 0) && !c.defaultNextPageId)
          issues.push(`🔴 ${label} 無 routes 也無 defaultNextPageId`);
        break;

      case "photo_mission":
        if (c.aiVerify && (!c.targetKeywords || !c.targetKeywords.length))
          issues.push(`🔴 ${label} aiVerify 開但 targetKeywords 空`);
        break;
    }

    // visited_location 相依
    if (p.pageType === "conditional_verify" && Array.isArray(c.conditions)) {
      for (const cond of c.conditions) {
        if (cond.type === "visited_location" && cond.locationId) {
          const id = String(cond.locationId);
          if (!locationsNeeded.has(id)) locationsNeeded.set(id, []);
          locationsNeeded.get(id).push(label);
        }
      }
    }

    // item 依賴
    if (p.pageType === "conditional_verify" && Array.isArray(c.conditions)) {
      for (const cond of c.conditions) {
        if (cond.type === "has_item" && cond.itemId) {
          const id = String(cond.itemId);
          if (!itemsNeeded.has(id)) itemsNeeded.set(id, []);
          itemsNeeded.get(id).push(label);
        }
      }
    }
    if (Array.isArray(c.onCompleteActions)) {
      for (const a of c.onCompleteActions) {
        if (a.type === "add_item" && a.itemId) itemsGranted.add(String(a.itemId));
      }
    }
    if (c.onSuccess?.grantItem) itemsGranted.add(String(c.onSuccess.grantItem));
    if (p.pageType === "qr_scan" && c.rewardItems) {
      (Array.isArray(c.rewardItems) ? c.rewardItems : []).forEach((i) => itemsGranted.add(String(i)));
    }
    if (Array.isArray(c.buttons)) {
      for (const b of c.buttons) {
        if (Array.isArray(b.items)) b.items.forEach((i) => itemsGranted.add(String(i)));
      }
    }
  }

  for (const [locId, needs] of locationsNeeded) {
    if (!locationsVisited.has(locId)) {
      issues.push(`🔴 需要造訪 location '${locId}' 但沒有 QR/GPS 頁面會標記（${needs.join(", ")}）`);
    }
  }
  for (const [itemId, needs] of itemsNeeded) {
    if (!itemsGranted.has(itemId)) {
      issues.push(`🔴 需要 item '${itemId}' 但無頁面授予（${needs.join(", ")}）`);
    }
  }

  const category = mod.category;
  perCategory[category] = perCategory[category] || [];
  perCategory[category].push({ mod, issues });

  issues.forEach((i) => {
    if (i.startsWith("🔴")) totalCritical++;
    else if (i.startsWith("⚠️")) totalWarnings++;
    else if (i.startsWith("🟡")) totalInfos++;
  });
}

// 輸出報告
for (const [cat, mods] of Object.entries(perCategory)) {
  console.log(`\n━━━ 【${MODULE_CATEGORY_LABELS[cat] || cat}】━━━`);
  for (const { mod, issues } of mods) {
    const icon = issues.length === 0 ? "🟢" : issues.some((i) => i.startsWith("🔴")) ? "🔴" : "🟡";
    console.log(`\n${icon} ${mod.name} (${mod.id}) — ${mod.pages.length} 頁`);
    if (issues.length === 0) console.log("   ✅ 配置完整");
    else issues.forEach((i) => console.log(`   ${i}`));
  }
}

console.log("\n" + "=".repeat(70));
console.log(`  總計：${GAME_MODULES.length} 套模組`);
console.log(`  🔴 嚴重：${totalCritical}  ⚠️  警告：${totalWarnings}  🟡 提示：${totalInfos}`);
console.log("=".repeat(70) + "\n");
