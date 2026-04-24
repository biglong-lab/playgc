// 🎯 Server-side 動態 OG / Twitter Card / <title> middleware
//
// 問題：SPA 分享連結 preview 都顯示一樣的「CHITO — Play the Place」
// 解法：針對 /f/:code 和 /f/:code/game/:gameId 等動態路由，
//       server 讀 DB 拿實際場域/遊戲資料，注入 OG tags 到 index.html。
//
// 設計：
// - Memory cache 5 分鐘避免每次打 DB
// - DB 失敗 fallback 原始 index.html（不 block）
// - 一般瀏覽器和 crawler 都吃這個（link preview 正確 + SEO 改善）
import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { fields, games, parseFieldSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_IMAGE = "https://game.homi.cc/icons/pwa-512.png";
const DEFAULT_TITLE = "CHITO — Play the Place";
const DEFAULT_DESCRIPTION =
  "CHITO — 實境遊戲 SaaS 平台。透過 QR Code、GPS、拍照任務，把每個場域變成可以玩的遊戲。";

// Memory cache：key -> { html, expiresAt }
const metaCache = new Map<string, { html: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60_000;

interface MetaPayload {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "website" | "article";
}

/** HTML escape 避免注入（name 可能含 "、<） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 把 HTML 的 OG tags 區塊替換成動態內容 */
function injectMeta(html: string, meta: MetaPayload, jsonLd?: Record<string, unknown>): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);

  // 替換 <title>
  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);

  // 替換既有 OG tags（保留 og:site_name 和 og:locale）
  next = next.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${t}" />`);
  next = next.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${d}" />`);
  next = next.replace(/<meta property="og:type"[^>]*>/i, `<meta property="og:type" content="${meta.type}" />`);
  next = next.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}" />`);
  next = next.replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${img}" />`);

  // 替換或新增 description meta
  if (/<meta name="description"/i.test(next)) {
    next = next.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${d}" />`);
  } else {
    next = next.replace(/<\/head>/i, `<meta name="description" content="${d}" />\n</head>`);
  }

  // 新增 Twitter Card（若已存在就替換，否則注入 </head> 前）
  const twitterTags = `
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />`;
  next = next.replace(/<meta name="twitter:card"[^>]*>\s*/gi, "");
  next = next.replace(/<meta name="twitter:title"[^>]*>\s*/gi, "");
  next = next.replace(/<meta name="twitter:description"[^>]*>\s*/gi, "");
  next = next.replace(/<meta name="twitter:image"[^>]*>\s*/gi, "");
  next = next.replace(/<\/head>/i, `${twitterTags}\n</head>`);

  // JSON-LD structured data（SEO + AEO）
  if (jsonLd) {
    const ldScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
    // 先移除既有的再加（避免累積）
    next = next.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");
    next = next.replace(/<\/head>/i, `${ldScript}\n</head>`);
  }

  return next;
}

/** 預設 meta（首頁 /、/f 等無特定場域的路徑） */
function defaultMeta(reqUrl: string): { meta: MetaPayload; jsonLd: Record<string, unknown> } {
  const meta: MetaPayload = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_IMAGE,
    url: `https://game.homi.cc${reqUrl}`,
    type: "website",
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CHITO",
    description: DEFAULT_DESCRIPTION,
    url: "https://game.homi.cc",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://game.homi.cc/f?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
  return { meta, jsonLd };
}

/** 根據 URL 組出 meta + JSON-LD；DB 失敗回 null（fallback 預設） */
async function resolveMeta(
  reqUrl: string,
): Promise<{ meta: MetaPayload; jsonLd: Record<string, unknown> } | null> {
  try {
    // /f/:code 或 /f/:code/...
    const fieldMatch = reqUrl.match(/^\/f\/([A-Z0-9_-]+)(?:\/|$|\?)/i);
    if (fieldMatch) {
      const code = fieldMatch[1].toUpperCase();
      const gameIdMatch = reqUrl.match(/^\/f\/[A-Z0-9_-]+\/game\/([A-Za-z0-9-]+)/i);
      const gameId = gameIdMatch?.[1];

      const field = await db.query.fields.findFirst({
        where: eq(fields.code, code),
        columns: { id: true, code: true, name: true, logoUrl: true, settings: true },
      });
      if (!field) return null;

      const settings = parseFieldSettings(field.settings);
      const fieldImage =
        settings.theme?.coverImageUrl ||
        settings.theme?.brandingLogoUrl ||
        field.logoUrl ||
        DEFAULT_IMAGE;
      const fieldDesc = settings.tagline || settings.welcomeMessage || DEFAULT_DESCRIPTION;

      // 🎯 如果是遊戲頁 /f/:code/game/:gameId
      if (gameId) {
        const game = await db.query.games.findFirst({
          where: eq(games.id, gameId),
          columns: { id: true, title: true, description: true, coverImageUrl: true },
        });
        if (game) {
          const meta: MetaPayload = {
            title: `${game.title} · ${field.name} · CHITO`,
            description: game.description || fieldDesc,
            image: game.coverImageUrl || fieldImage,
            url: `https://game.homi.cc${reqUrl}`,
            type: "article",
          };
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "Event",
            name: game.title,
            description: game.description || fieldDesc,
            image: game.coverImageUrl || fieldImage,
            organizer: {
              "@type": "Organization",
              name: field.name,
              url: `https://game.homi.cc/f/${field.code}`,
            },
            location: {
              "@type": "Place",
              name: field.name,
            },
          };
          return { meta, jsonLd };
        }
      }

      // 🏢 場域頁 /f/:code
      const meta: MetaPayload = {
        title: `${field.name} · CHITO`,
        description: fieldDesc,
        image: fieldImage,
        url: `https://game.homi.cc/f/${field.code}`,
        type: "website",
      };
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: field.name,
        description: fieldDesc,
        image: fieldImage,
        url: `https://game.homi.cc/f/${field.code}`,
      };
      return { meta, jsonLd };
    }

    // /g/:slug — 公開遊戲短連結
    const slugMatch = reqUrl.match(/^\/g\/([A-Za-z0-9-]+)/i);
    if (slugMatch) {
      const slug = slugMatch[1];
      const game = await db.query.games.findFirst({
        where: eq(games.publicSlug, slug),
        columns: { id: true, title: true, description: true, coverImageUrl: true, fieldId: true },
      });
      if (!game) return null;
      const field = game.fieldId
        ? await db.query.fields.findFirst({
            where: eq(fields.id, game.fieldId),
            columns: { code: true, name: true },
          })
        : null;
      const meta: MetaPayload = {
        title: `${game.title}${field ? ` · ${field.name}` : ""} · CHITO`,
        description: game.description || DEFAULT_DESCRIPTION,
        image: game.coverImageUrl || DEFAULT_IMAGE,
        url: `https://game.homi.cc/g/${slug}`,
        type: "article",
      };
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: game.title,
        description: game.description || DEFAULT_DESCRIPTION,
        image: game.coverImageUrl || DEFAULT_IMAGE,
        ...(field && {
          organizer: {
            "@type": "Organization",
            name: field.name,
            url: `https://game.homi.cc/f/${field.code}`,
          },
        }),
      };
      return { meta, jsonLd };
    }

    // 其他路徑（/、/f、/apply 等）用預設
    return defaultMeta(reqUrl);
  } catch (err) {
    console.error("[og-meta] resolve failed:", err);
    return null;
  }
}

/**
 * SPA fallback middleware 帶 OG 注入
 * 取代 server/static.ts 的 `app.use("*", ...)` fallback
 */
export function serveIndexWithMeta(distPath: string) {
  const indexPath = path.resolve(distPath, "index.html");

  return async (req: Request, res: Response, next: NextFunction) => {
    // API 路徑不 fallback
    const url = req.originalUrl || req.url;
    if (url.startsWith("/api/")) {
      return res.status(404).json({ message: "Not found" });
    }
    // 靜態資源（有副檔名的）不處理
    if (/\.[a-z0-9]{2,5}(\?|$)/i.test(url)) {
      return next();
    }

    // Cache key: 只用 pathname（query 不影響 meta）
    const cacheKey = url.split("?")[0];
    const cached = metaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.send(cached.html);
    }

    try {
      const originalHtml = fs.readFileSync(indexPath, "utf-8");
      const resolved = await resolveMeta(url);
      const payload = resolved || defaultMeta(url);
      const html = injectMeta(originalHtml, payload.meta, payload.jsonLd);

      metaCache.set(cacheKey, { html, expiresAt: Date.now() + CACHE_TTL_MS });
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err) {
      console.error("[og-meta] serve failed, fallback to raw index.html:", err);
      return res.sendFile(indexPath);
    }
  };
}

/** 清除快取（測試或 schema 變動時） */
export function clearOgMetaCache() {
  metaCache.clear();
}
