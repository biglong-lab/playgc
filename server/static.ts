import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { serveIndexWithMeta } from "./middleware/og-meta";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // 🆕 SPA fallback 帶 OG meta 動態注入
  // 對 /f/:code、/f/:code/game/:gameId、/g/:slug 等路徑讀 DB 注入正確的 OG tags
  // 讓 Facebook / LINE / Twitter / ChatGPT 等 crawler 能看到動態標題、描述、縮圖
  app.use("*", serveIndexWithMeta(distPath));
}
