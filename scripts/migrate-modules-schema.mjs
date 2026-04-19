#!/usr/bin/env node
/**
 * 升級 shared/schema/modules/*.ts 的舊 schema 到新 schema
 *
 * 轉換規則：
 *   choice_verify:
 *     options: ["a", "b", "c"] + correctIndex: 1
 *       → options: [{text:"a", correct:false}, {text:"b", correct:true}, {text:"c", correct:false}]
 *       （刪除 correctIndex）
 *
 *   lock:
 *     correctCode: "1234", codeLength: 4
 *       → combination: "1234", digits: 4
 *       （刪除 correctCode、codeLength）
 */
import fs from "fs";
import path from "path";

const MODULES_DIR = "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules";
const files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".ts"));

let totalChoiceFixed = 0;
let totalLockFixed = 0;

for (const file of files) {
  const filePath = path.join(MODULES_DIR, file);
  let content = fs.readFileSync(filePath, "utf-8");
  const originalContent = content;

  // === 1. choice_verify: options + correctIndex ===
  // 匹配 config 中同時有 options 字串陣列 + correctIndex 的區塊
  // 用 regex 抓取整個 config 物件，轉換後替換
  //
  // 簡化版：尋找 "options: [\"...\", \"...\"],\n...correctIndex: N," 的 pattern
  const choiceRegex = /options:\s*\[([^\]]+)\],\s*\n\s*correctIndex:\s*(\d+)/g;
  content = content.replace(choiceRegex, (match, optsStr, idxStr) => {
    totalChoiceFixed++;
    const correctIdx = parseInt(idxStr, 10);
    // 解析 options 字串陣列為實際字串
    const parsedOpts = optsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // 去除引號
        return s.replace(/^["'`]|["'`]$/g, "");
      });

    const newOpts = parsedOpts
      .map((text, i) => `          { text: "${text}", correct: ${i === correctIdx} }`)
      .join(",\n");

    return `options: [\n${newOpts},\n        ]`;
  });

  // === 2. lock: correctCode + codeLength → combination + digits ===
  const lockRegex = /correctCode:\s*"([^"]+)"(?:,\s*\n\s*codeLength:\s*(\d+))?/g;
  content = content.replace(lockRegex, (match, code, length) => {
    totalLockFixed++;
    const digits = length || code.length;
    return `combination: "${code}",\n        digits: ${digits}`;
  });
  // 清掉剩餘的 codeLength（如果是單獨出現）
  content = content.replace(/,?\s*\n\s*codeLength:\s*\d+,?/g, "");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ 已升級：${file}`);
  }
}

console.log(`\n🎉 總計升級：`);
console.log(`  choice_verify: ${totalChoiceFixed} 處`);
console.log(`  lock:          ${totalLockFixed} 處\n`);
