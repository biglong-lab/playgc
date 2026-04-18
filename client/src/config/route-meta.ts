// 🗺️ 路由 Meta 中央配置
// 用於：自動產生麵包屑 / PageHeader 標題 / 側邊欄子層級高亮
// 鍵：路由 pattern（支援 :param）、值：meta 資訊

export interface RouteMeta {
  /** 頁面標題 */
  title: string;
  /** 副標題（選填） */
  subtitle?: string;
  /** 父層路徑（用於麵包屑） */
  parent?: string;
  /** 分組 emoji（用於視覺） */
  emoji?: string;
  /** 一句話說明（用於 tooltip） */
  description?: string;
  /** 所屬世界／中心 */
  section?: "platform" | "games" | "battle" | "revenue" | "field" | "me" | "player";
}

/**
 * 路由 meta 定義
 * 支援動態路由：用 `:param` 當佔位，實際比對會走 pattern matching
 */
export const ROUTE_META: Record<string, RouteMeta> = {
  // ═══════════════════════════════════════════════
  // 🌐 平台後台
  // ═══════════════════════════════════════════════
  "/platform": {
    title: "平台儀表板",
    emoji: "🌐",
    section: "platform",
  },
  "/platform/fields": {
    title: "場域管理",
    parent: "/platform",
    emoji: "🏢",
    section: "platform",
    description: "管理所有租戶場域的訂閱與狀態",
  },
  "/platform/applications": {
    title: "場域申請審核",
    parent: "/platform",
    emoji: "📋",
    section: "platform",
    description: "審核公開申請的新場域",
  },
  "/platform/plans": {
    title: "訂閱方案",
    parent: "/platform",
    emoji: "📦",
    section: "platform",
  },
  "/platform/feature-flags": {
    title: "功能開關",
    parent: "/platform",
    emoji: "🎛️",
    section: "platform",
  },
  "/platform/revenue": {
    title: "平台營收",
    parent: "/platform",
    emoji: "💵",
    section: "platform",
  },
  "/platform/analytics": {
    title: "跨場域數據分析",
    parent: "/platform",
    emoji: "📊",
    section: "platform",
    description: "比較所有場域的遊戲數 / 結帳 / 對戰 / 平台費",
  },
  "/platform/settings": {
    title: "平台設定",
    parent: "/platform",
    emoji: "⚙️",
    section: "platform",
  },

  // ═══════════════════════════════════════════════
  // 📊 場域管理 - 系統總覽
  // ═══════════════════════════════════════════════
  "/admin": {
    title: "儀表板",
    emoji: "📊",
    section: "field",
  },
  "/admin/analytics": {
    title: "數據分析",
    parent: "/admin",
    emoji: "📈",
    section: "field",
  },
  "/admin/leaderboard": {
    title: "排行榜",
    parent: "/admin",
    emoji: "🏆",
    section: "field",
  },

  // ═══════════════════════════════════════════════
  // 🎮 遊戲中心
  // ═══════════════════════════════════════════════
  "/admin/games": {
    title: "遊戲管理",
    parent: "/admin",
    emoji: "🎮",
    section: "games",
  },
  "/admin/games/:gameId": {
    title: "遊戲編輯",
    parent: "/admin/games",
    emoji: "✏️",
    section: "games",
  },
  "/admin/games/:gameId/settings": {
    title: "遊戲設定",
    parent: "/admin/games/:gameId",
    emoji: "⚙️",
    section: "games",
  },
  "/admin/games/:gameId/chapters": {
    title: "章節管理",
    parent: "/admin/games/:gameId",
    emoji: "📖",
    section: "games",
  },
  "/admin/games/:gameId/locations": {
    title: "地點編輯",
    parent: "/admin/games/:gameId",
    emoji: "📍",
    section: "games",
  },
  "/admin/games/:gameId/items": {
    title: "道具管理",
    parent: "/admin/games/:gameId",
    emoji: "🎒",
    section: "games",
  },
  "/admin/games/:gameId/achievements": {
    title: "成就管理",
    parent: "/admin/games/:gameId",
    emoji: "🏅",
    section: "games",
  },
  "/admin/games/:gameId/tickets": {
    title: "兌換碼管理",
    parent: "/admin/games/:gameId",
    emoji: "🎫",
    section: "games",
  },
  "/admin/templates": {
    title: "模組庫",
    parent: "/admin",
    emoji: "📚",
    section: "games",
  },
  "/admin/sessions": {
    title: "進行中場次",
    parent: "/admin",
    emoji: "🎯",
    section: "games",
  },
  "/admin/devices": {
    title: "設備管理",
    parent: "/admin",
    emoji: "💡",
    section: "games",
  },
  "/admin/qrcodes": {
    title: "QR Code 發布",
    parent: "/admin",
    emoji: "📱",
    section: "games",
  },

  // ═══════════════════════════════════════════════
  // ⚔️ 對戰中心
  // ═══════════════════════════════════════════════
  "/admin/battle/dashboard": {
    title: "對戰儀表板",
    parent: "/admin",
    emoji: "⚔️",
    section: "battle",
  },
  "/admin/battle/venues": {
    title: "場地管理",
    parent: "/admin/battle/dashboard",
    emoji: "📍",
    section: "battle",
  },
  "/admin/battle/slots": {
    title: "時段管理",
    parent: "/admin/battle/dashboard",
    emoji: "⏰",
    section: "battle",
  },
  "/admin/battle/rankings": {
    title: "對戰排名",
    parent: "/admin/battle/dashboard",
    emoji: "🏆",
    section: "battle",
  },
  "/admin/battle/seasons": {
    title: "賽季管理",
    parent: "/admin/battle/dashboard",
    emoji: "📅",
    section: "battle",
  },

  // ═══════════════════════════════════════════════
  // 💰 財務中心
  // ═══════════════════════════════════════════════
  "/admin/revenue": {
    title: "營收總覽",
    parent: "/admin",
    emoji: "💰",
    section: "revenue",
  },
  "/admin/revenue/products": {
    title: "商品管理",
    parent: "/admin/revenue",
    emoji: "📦",
    section: "revenue",
  },
  "/admin/revenue/codes": {
    title: "兌換碼中心",
    parent: "/admin/revenue",
    emoji: "🎫",
    section: "revenue",
  },
  "/admin/revenue/transactions": {
    title: "交易記錄",
    parent: "/admin/revenue",
    emoji: "📝",
    section: "revenue",
  },
  "/admin/tickets": {
    title: "票券/收款（舊版）",
    parent: "/admin/revenue",
    emoji: "🎟️",
    section: "revenue",
  },

  // ═══════════════════════════════════════════════
  // 🏢 場域總部
  // ═══════════════════════════════════════════════
  "/admin/field/subscription": {
    title: "我的方案",
    parent: "/admin",
    emoji: "💼",
    section: "field",
  },
  "/admin/fields": {
    title: "場域基本資料",
    parent: "/admin",
    emoji: "🏢",
    section: "field",
  },
  "/admin/field-settings": {
    title: "場域進階設定",
    parent: "/admin",
    emoji: "🎛️",
    section: "field",
  },
  "/admin/roles": {
    title: "角色管理",
    parent: "/admin",
    emoji: "🔑",
    section: "field",
  },
  "/admin/accounts": {
    title: "管理員帳號",
    parent: "/admin",
    emoji: "👥",
    section: "field",
  },
  "/admin/players": {
    title: "玩家管理",
    parent: "/admin",
    emoji: "🎮",
    section: "field",
  },
  "/admin/audit-logs": {
    title: "操作記錄",
    parent: "/admin",
    emoji: "📋",
    section: "field",
  },
  "/admin/settings": {
    title: "系統設定",
    parent: "/admin",
    emoji: "⚙️",
    section: "field",
  },

  // ═══════════════════════════════════════════════
  // 👤 玩家端
  // ═══════════════════════════════════════════════
  "/": { title: "首頁", emoji: "🏠", section: "player" },
  "/home": { title: "遊戲大廳", emoji: "🎮", section: "player" },
  "/me": { title: "會員中心", emoji: "💳", section: "me" },
  "/purchases": { title: "我的購買", parent: "/me", emoji: "🧾", section: "me" },
  "/leaderboard": { title: "排行榜", parent: "/home", emoji: "🏆", section: "player" },
  "/battle": { title: "競技擂台", emoji: "⚔️", section: "player" },
  "/battle/ranking": { title: "對戰排名", parent: "/battle", emoji: "🏆", section: "player" },
  "/battle/my": { title: "我的對戰", parent: "/battle", emoji: "👤", section: "player" },
  "/battle/history": { title: "對戰歷史", parent: "/me", emoji: "📜", section: "me" },
  "/battle/achievements": { title: "對戰成就", parent: "/me", emoji: "🏅", section: "me" },
  "/battle/notifications": { title: "通知中心", parent: "/me", emoji: "🔔", section: "me" },
};

/**
 * 路由 pattern matcher — 將實際 URL 對應到 meta
 * 例如：/admin/games/abc123 → /admin/games/:gameId
 */
export function matchRouteMeta(pathname: string): {
  pattern: string;
  meta: RouteMeta;
} | null {
  // 優先精確比對
  if (ROUTE_META[pathname]) {
    return { pattern: pathname, meta: ROUTE_META[pathname] };
  }

  // pattern 比對（優先最長匹配）
  const patterns = Object.keys(ROUTE_META).sort((a, b) => b.length - a.length);
  for (const pattern of patterns) {
    if (matchPattern(pathname, pattern)) {
      return { pattern, meta: ROUTE_META[pattern] };
    }
  }

  return null;
}

function matchPattern(pathname: string, pattern: string): boolean {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    if (pp.startsWith(":")) continue; // 動態參數，跳過比對
    if (pp !== pathParts[i]) return false;
  }
  return true;
}

/**
 * 將 pattern 帶入實際參數
 * /admin/games/:gameId + { gameId: "abc" } → /admin/games/abc
 */
export function resolvePattern(
  pattern: string,
  params: Record<string, string>
): string {
  return pattern.replace(/:(\w+)/g, (_, key) => params[key] ?? `:${key}`);
}

/**
 * 從 pathname 抽出參數
 * /admin/games/abc + pattern /admin/games/:gameId → { gameId: "abc" }
 */
export function extractParams(
  pathname: string,
  pattern: string
): Record<string, string> {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = pathParts[i] ?? "";
    }
  }
  return params;
}

/**
 * 產生麵包屑項目陣列（從根到當前頁）
 */
export interface BreadcrumbItem {
  title: string;
  path?: string; // 最後一項不含 path
  emoji?: string;
}

export function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const matched = matchRouteMeta(pathname);
  if (!matched) return [];

  const chain: BreadcrumbItem[] = [];
  const params = extractParams(pathname, matched.pattern);

  // 先把當前頁加入
  chain.unshift({
    title: matched.meta.title,
    emoji: matched.meta.emoji,
  });

  // 往上追溯 parent
  let currentPattern: string | undefined = matched.meta.parent;
  const visited = new Set<string>();
  while (currentPattern && !visited.has(currentPattern)) {
    visited.add(currentPattern);
    const parentMeta = ROUTE_META[currentPattern];
    if (!parentMeta) break;
    const resolvedPath = resolvePattern(currentPattern, params);
    chain.unshift({
      title: parentMeta.title,
      path: resolvedPath,
      emoji: parentMeta.emoji,
    });
    currentPattern = parentMeta.parent;
  }

  return chain;
}
