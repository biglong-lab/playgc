import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback — 只對非檔案路徑回傳 index.html
  // 排除 API 路由和靜態檔案（robots.txt、sitemap.xml 等）
  app.use("*", (req, res) => {
    const url = req.originalUrl || req.url;
    // API 路徑不 fallback
    if (url.startsWith("/api/")) return res.status(404).json({ message: "Not found" });
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
