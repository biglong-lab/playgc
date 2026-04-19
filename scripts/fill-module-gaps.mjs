#!/usr/bin/env node
/**
 * 補齊模組的「空 video URL」與「空 time_bomb tasks」
 * - video: 填 placeholder URL（Big Buck Bunny 公版影片示範）+ 開啟 skip
 * - time_bomb: 補 tap + input 範例任務
 */
import fs from "fs";
import path from "path";

const MODULES_DIR = "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/modules";
const GAME_MODULES_FILE = "/Users/hung-macmini/projects/數位遊戲平台/shared/schema/game-modules.ts";
const PLACEHOLDER_VIDEO = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const files = [
  GAME_MODULES_FILE,
  ...fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".ts")).map((f) => path.join(MODULES_DIR, f)),
];

let videoFixed = 0;
let bombFixed = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // 1. 空 videoUrl → placeholder URL + skipEnabled true
  // 先找 `videoUrl: "",` 這種 pattern 把 URL 填入
  content = content.replace(/videoUrl:\s*""\s*,/g, () => {
    videoFixed++;
    return `videoUrl: "${PLACEHOLDER_VIDEO}", // TODO: 管理員請改成實際影片\n        skipEnabled: true,`;
  });

  // 2. 空 tasks → 補範例
  // 找 `tasks: []` 或 `tasks: [],`（單行空陣列）
  content = content.replace(
    /tasks:\s*\[\s*\]/g,
    () => {
      bombFixed++;
      return `tasks: [
          { type: "tap", targetCount: 15, question: "快速拆除引信 — 點擊 15 下！" },
          { type: "input", question: "輸入拆彈密碼（預設：0000）", answer: "0000" },
        ]`;
    },
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ ${filePath.split("/").pop()}`);
  }
}

console.log(`\n🎉 補齊：${videoFixed} 個 video URL, ${bombFixed} 個 time_bomb tasks\n`);
