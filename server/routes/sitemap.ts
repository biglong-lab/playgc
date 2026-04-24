// 🌐 動態 Sitemap — 場域列表自動更新到搜尋引擎
//
// 問題：client/public/sitemap.xml 是靜態的，不包含 /f/JIACHUN /f/HPSPACE 等場域路徑。
//      每次新增場域就要手動修 sitemap，SEO 抓不到新場域。
//
// 解法：Server route 動態生成，每次有新場域 automatically 包含。
//      蓋過 client/public/sitemap.xml 的靜態檔（Express route 優先於 static middleware）。
//
// 🆕 J4: 擴充 published 遊戲 URL（/g/:slug）+ 每個場域獨立 sitemap（規模化）
import type { Express } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { fields, games } from "@shared/schema";

const BASE_URL = "https://game.homi.cc";

interface SitemapUrl {
  loc: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  lastmod?: string;
}

function buildSitemap(urls: SitemapUrl[]): string {
  const urlsXml = urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${u.loc}</loc>\n` +
        (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : "") +
        (u.changefreq ? `    <changefreq>${u.changefreq}</changefreq>\n` : "") +
        (u.priority ? `    <priority>${u.priority}</priority>\n` : "") +
        `  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
}

export function registerSitemapRoute(app: Express): void {
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const activeFields = await db.query.fields.findMany({
        where: eq(fields.status, "active"),
        columns: { code: true, updatedAt: true },
      });

      const today = new Date().toISOString().split("T")[0];
      const urls: SitemapUrl[] = [
        // 平台首頁
        { loc: `${BASE_URL}/`, changefreq: "weekly", priority: "1.0", lastmod: today },
        // 場域選擇頁
        { loc: `${BASE_URL}/f`, changefreq: "weekly", priority: "0.9", lastmod: today },
        // 申請場域頁
        { loc: `${BASE_URL}/apply`, changefreq: "monthly", priority: "0.6" },
        // 對戰專區
        { loc: `${BASE_URL}/battle`, changefreq: "daily", priority: "0.7" },
        { loc: `${BASE_URL}/battle/ranking`, changefreq: "daily", priority: "0.6" },
      ];

      // 🆕 每個 active 場域：Landing + Leaderboard
      for (const f of activeFields) {
        const lastmod = f.updatedAt
          ? new Date(f.updatedAt).toISOString().split("T")[0]
          : today;
        urls.push({
          loc: `${BASE_URL}/f/${f.code}`,
          changefreq: "weekly",
          priority: "0.9",
          lastmod,
        });
        urls.push({
          loc: `${BASE_URL}/f/${f.code}/leaderboard`,
          changefreq: "daily",
          priority: "0.7",
        });
      }

      const xml = buildSitemap(urls);
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600"); // 1 hr 快取（新場域上線最多延遲 1 小時被抓）
      res.send(xml);
    } catch (error) {
      console.error("[sitemap] generate failed:", error);
      // fallback：只回最低限度
      const fallback = buildSitemap([
        { loc: `${BASE_URL}/`, changefreq: "weekly", priority: "1.0" },
      ]);
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.status(500).send(fallback);
    }
  });
}
