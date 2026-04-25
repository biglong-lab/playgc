// SEO 輔助純函式（可單元測試）

export interface OgImageOptions {
  name: string;
  tag: string;
  totalGames: number;
  recruitsCount: number;
  superLeaderTier?: string | null;
}

export interface SchemaJsonLdOptions {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  emblemUrl?: string | null;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  baseUrl?: string;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildOgImageSvg(opts: OgImageOptions): string {
  const tierLabel: Record<string, string> = {
    bronze: "🥉 Bronze",
    silver: "🥈 Silver",
    gold: "🥇 Gold",
    platinum: "💎 Platinum",
    super: "🌟 Super",
  };
  const tierBadge = opts.superLeaderTier ? tierLabel[opts.superLeaderTier] ?? "" : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="60" y="80" font-family="sans-serif" font-size="36" fill="#a7f3d0">CHITO · 隊伍頁</text>
  <text x="60" y="220" font-family="sans-serif" font-size="96" font-weight="bold" fill="#ffffff">
    ${escapeXml(opts.name)}
  </text>
  <text x="60" y="280" font-family="monospace" font-size="40" fill="#6ee7b7">
    [${escapeXml(opts.tag)}]
  </text>
  ${tierBadge ? `<text x="60" y="370" font-family="sans-serif" font-size="48" fill="#fbbf24">${tierBadge}</text>` : ""}
  <text x="60" y="490" font-family="sans-serif" font-size="36" fill="#d1fae5">
    🏆 總場次：${opts.totalGames}
  </text>
  <text x="60" y="540" font-family="sans-serif" font-size="36" fill="#d1fae5">
    👥 招募成員：${opts.recruitsCount}
  </text>
  <text x="60" y="600" font-family="sans-serif" font-size="24" fill="#9ca3af">
    game.homi.cc · Play the Place
  </text>
</svg>`;
}

export function buildSchemaJsonLd(opts: SchemaJsonLdOptions) {
  const baseUrl = opts.baseUrl ?? process.env.PUBLIC_BASE_URL ?? "https://game.homi.cc";
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    "@id": `${baseUrl}/squad/${opts.id}`,
    name: opts.name,
    alternateName: opts.tag,
    description:
      opts.description ?? `${opts.name}（${opts.tag}）— CHITO 平台隊伍`,
    logo: opts.emblemUrl ?? undefined,
    url: `${baseUrl}/squad/${opts.id}`,
    sport: "水彈對戰 / 實境遊戲",
    additionalProperty: [
      { "@type": "PropertyValue", name: "totalGames", value: opts.totalGames },
      { "@type": "PropertyValue", name: "totalWins", value: opts.totalWins },
      { "@type": "PropertyValue", name: "totalLosses", value: opts.totalLosses },
    ],
  };
}
