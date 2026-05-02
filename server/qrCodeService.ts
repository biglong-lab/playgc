import QRCode from "qrcode";
import { db } from "./db";
import { games } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * 產生 QR Code 用的對外網址 base
 *
 * 🔄 2026-05-02：原本 fallback 是 Replit 殘留的 `http://localhost:5000`，
 *   導致正式環境（無 REPLIT_DEV_DOMAIN）的 QR 內容指向 localhost — 玩家掃出來連不上。
 *
 * 優先序：
 *   1. PUBLIC_BASE_URL — 自訂正式網址（生產環境必須設定，例：https://game.homi.cc）
 *   2. APP_URL — 別名（很多舊配置慣用此 key）
 *   3. REPLIT_DEV_DOMAIN — 向後相容（本地若有 Replit dev 環境）
 *   4. localhost:3333 — 本地開發 fallback（5000 是舊 port，已改 3333）
 */
function resolveBaseUrl(): string {
  const fromPublic = process.env.PUBLIC_BASE_URL?.trim();
  if (fromPublic) return fromPublic.replace(/\/$/, ""); // 移除尾斜線

  const fromAppUrl = process.env.APP_URL?.trim();
  if (fromAppUrl) return fromAppUrl.replace(/\/$/, "");

  const fromReplit = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (fromReplit) return `https://${fromReplit}`;

  return "http://localhost:3333";
}

export function generateGameUrl(publicSlug: string): string {
  return `${resolveBaseUrl()}/g/${publicSlug}`;
}

/**
 * 取得遊戲的 publicSlug，沒有就建一個（不寫 QR PNG 到 DB）
 */
async function ensureGameSlug(gameId: string): Promise<string> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.publicSlug) return game.publicSlug;

  const slug = generateSlug();
  await db.update(games).set({ publicSlug: slug }).where(eq(games.id, gameId));
  return slug;
}

/**
 * 產生 QR Code DataURL（PNG base64）
 *
 * 🔄 2026-05-02：每次都動態產生，不再從 DB cache 讀。
 *   理由：cached qrCodeUrl 內含 BASE_URL 是「產生當下」的 URL，
 *         之後改網域 / 改 port 都會讓快取失效，玩家掃到舊網址。
 *   現在：DB 只存 publicSlug（穩定），QR PNG 每次 toDataURL 即時生成。
 *   舊欄位 games.qrCodeUrl 保留但不再寫入（不影響歷史相容）。
 */
export async function generateGameQRCode(gameId: string): Promise<string> {
  const slug = await ensureGameSlug(gameId);
  const gameUrl = generateGameUrl(slug);

  return QRCode.toDataURL(gameUrl, {
    type: "image/png",
    width: 400,
    margin: 2,
    color: {
      dark: "#1f2937",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

export async function generateQRCodeSVG(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    width: 400,
    margin: 2,
    color: {
      dark: "#1f2937",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
}

export function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getGameBySlug(slug: string) {
  return db.query.games.findFirst({
    where: eq(games.publicSlug, slug),
    with: {
      pages: {
        orderBy: (pages, { asc }) => [asc(pages.pageOrder)],
      },
      field: true,
    },
  });
}
