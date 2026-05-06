// 🆕 2026-05-07：Admin Changelog API
// 用途：AdminDashboard 顯示「系統更新紀錄」、讓 admin 知道最近改了什麼
//
// 來源：docs/CHANGELOG.md（人寫的、有意義的紀錄、非 hook auto commit）
// 解析：第二級標題 ## YYYY-MM-DD 為一個版本、底下 ### 為條目
//
// 端點：
//   GET /api/admin/changelog       回傳全部條目（依日期 desc）
//   GET /api/admin/changelog?limit=5  限制最新 N 條

import type { Express } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdminAuth } from "../adminAuth";

interface ChangelogEntry {
  date: string;
  title: string;
  body: string;
}

let cache: { entries: ChangelogEntry[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

async function loadChangelog(): Promise<ChangelogEntry[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.entries;
  }

  const filePath = path.join(process.cwd(), "docs", "CHANGELOG.md");
  let content = "";
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const entries: ChangelogEntry[] = [];
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const dateLine = lines[0]?.trim();
    if (!dateLine || !/^\d{4}-\d{2}-\d{2}$/.test(dateLine)) continue;

    const rest = lines.slice(1).join("\n");
    const subSections = rest.split(/^### /m).slice(1);

    for (const sub of subSections) {
      const subLines = sub.split("\n");
      const title = subLines[0]?.trim() ?? "";
      const body = subLines.slice(1).join("\n").trim();
      if (title) {
        entries.push({ date: dateLine, title, body });
      }
    }
  }

  cache = { entries, loadedAt: Date.now() };
  return entries;
}

export function registerAdminChangelogRoutes(app: Express) {
  app.get("/api/admin/changelog", requireAdminAuth, async (req, res) => {
    try {
      const entries = await loadChangelog();
      const limitRaw = req.query.limit;
      const limit = typeof limitRaw === "string" ? Math.max(1, Math.min(100, parseInt(limitRaw))) : undefined;
      res.json({
        total: entries.length,
        entries: limit ? entries.slice(0, limit) : entries,
      });
    } catch (err) {
      console.error("[admin-changelog] failed:", err);
      res.status(500).json({ error: "讀取更新紀錄失敗" });
    }
  });
}
