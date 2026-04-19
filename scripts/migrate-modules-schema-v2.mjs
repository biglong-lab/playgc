#!/usr/bin/env node
/**
 * v2 — 更寬鬆的 regex 抓取 game-modules.ts 主檔的舊 schema
 */
import fs from "fs";

const FILES = [
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/game-modules.ts",
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules/digital.ts",
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules/education.ts",
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules/indoor.ts",
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules/outdoor.ts",
  "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules/team.ts",
];

let totalChoice = 0;
let totalLock = 0;

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // choice_verify: options + correctIndex
  // 用 DOTALL 模式 (s flag) 讓 . 匹配換行
  const choiceRegex = /options:\s*\[\s*((?:"[^"]*"\s*,?\s*)+)\s*\]\s*,\s*correctIndex:\s*(\d+)/gs;
  content = content.replace(choiceRegex, (match, optsStr, idxStr) => {
    totalChoice++;
    const correctIdx = parseInt(idxStr, 10);
    // 從字串中抓取每個 "xxx" 字串
    const items = [...optsStr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const indent = "          ";
    const objectArr = items
      .map((text, i) => `${indent}{ text: "${text}", correct: ${i === correctIdx} }`)
      .join(",\n");
    return `options: [\n${objectArr},\n        ]`;
  });

  // lock: correctCode → combination（可能伴隨 codeLength）
  const lockRegex = /correctCode:\s*"([^"]+)"/g;
  content = content.replace(lockRegex, (match, code) => {
    totalLock++;
    return `combination: "${code}"`;
  });
  // 清 codeLength 並改為 digits
  content = content.replace(/codeLength:\s*(\d+)/g, "digits: $1");

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    const file = filePath.split("/").pop();
    console.log(`✓ ${file}`);
  }
}

console.log(`\n🎉 總計升級：${totalChoice} 個 choice + ${totalLock} 個 lock\n`);
