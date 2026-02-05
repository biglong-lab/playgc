import QRCode from "qrcode";
import { db } from "./db";
import { games } from "@shared/schema";
import { eq } from "drizzle-orm";

const BASE_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://localhost:5000";

export function generateGameUrl(publicSlug: string): string {
  return `${BASE_URL}/g/${publicSlug}`;
}

export async function generateGameQRCode(gameId: string): Promise<string> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.publicSlug) {
    const slug = generateSlug();
    await db.update(games).set({ publicSlug: slug }).where(eq(games.id, gameId));
    game.publicSlug = slug;
  }

  const gameUrl = generateGameUrl(game.publicSlug);
  
  const qrCodeDataUrl = await QRCode.toDataURL(gameUrl, {
    type: "image/png",
    width: 400,
    margin: 2,
    color: {
      dark: "#1f2937",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });

  await db.update(games).set({ qrCodeUrl: qrCodeDataUrl }).where(eq(games.id, gameId));

  return qrCodeDataUrl;
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
