// 🖼 generate-splash-screens — iOS PWA Splash 多解析度產生器
//
// 用既有 icons/pwa-512.png + theme color 合成 10 種解析度的 splash 圖。
// 輸出到 client/public/icons/splash/
//
// 跑：node scripts/generate-splash-screens.mjs

import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "client", "public");
const ICON_SRC = path.join(PUBLIC_DIR, "icons", "pwa-512.png");
const SPLASH_DIR = path.join(PUBLIC_DIR, "icons", "splash");

const BG_COLOR = { r: 0x11, g: 0x18, b: 0x27, alpha: 1 }; // #111827

// iPhone / iPad splash 規格（width x height、橫向不需要）
// 命名：splash-{w}x{h}.png
const SPECS = [
  // iPhone 14 Pro Max / 15 Plus / 16 Plus
  { w: 1290, h: 2796, name: "iPhone-14-Pro-Max" },
  // iPhone 14 Pro / 15 / 16
  { w: 1179, h: 2556, name: "iPhone-14-Pro" },
  // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
  { w: 1284, h: 2778, name: "iPhone-14-Plus" },
  // iPhone 14 / 13 Pro / 13 / 12 Pro / 12
  { w: 1170, h: 2532, name: "iPhone-13" },
  // iPhone 13 mini / 12 mini / 11 Pro / X / Xs
  { w: 1125, h: 2436, name: "iPhone-11-Pro" },
  // iPhone 11 / Xr
  { w: 828, h: 1792, name: "iPhone-11" },
  // iPhone 11 Pro Max / Xs Max
  { w: 1242, h: 2688, name: "iPhone-Xs-Max" },
  // iPhone 8 Plus / 7 Plus / 6 Plus
  { w: 1242, h: 2208, name: "iPhone-8-Plus" },
  // iPhone 8 / 7 / 6 / SE
  { w: 750, h: 1334, name: "iPhone-8" },
  // iPad Pro 12.9
  { w: 2048, h: 2732, name: "iPad-Pro-12-9" },
  // iPad Pro 11 / Air 10.9 / Air 10.5
  { w: 1668, h: 2388, name: "iPad-Pro-11" },
  // iPad mini / Air
  { w: 1536, h: 2048, name: "iPad-mini" },
];

async function main() {
  // 確保 splash 目錄存在
  await fs.mkdir(SPLASH_DIR, { recursive: true });

  // 讀取 icon
  const iconBuffer = await fs.readFile(ICON_SRC);

  for (const spec of SPECS) {
    const filename = `splash-${spec.w}x${spec.h}.png`;
    const outPath = path.join(SPLASH_DIR, filename);

    // icon 大小 = 短邊 * 0.3（不要太大太小）
    const shortSide = Math.min(spec.w, spec.h);
    const iconSize = Math.round(shortSide * 0.3);

    const resizedIcon = await sharp(iconBuffer)
      .resize(iconSize, iconSize, { fit: "contain" })
      .toBuffer();

    // 建立背景 + 中央放 icon
    await sharp({
      create: {
        width: spec.w,
        height: spec.h,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([
        {
          input: resizedIcon,
          gravity: "center",
        },
      ])
      .png()
      .toFile(outPath);

    console.log(`✅ ${filename} (${spec.name}, ${spec.w}x${spec.h})`);
  }

  console.log(`\n🎉 完成 ${SPECS.length} 個 splash 圖 → ${SPLASH_DIR}`);
}

main().catch((err) => {
  console.error("❌ 失敗：", err);
  process.exit(1);
});
