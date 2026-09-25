// 🧩 模組登錄表（P2 底座，2026-09-23；前後端共用的單一真相）
//
// 業主：「優化管理 — 模組關掉時選單、API、排程同時停」
// hung-blocks 積木鐵則 4「積木可拆卸」：模組註冊表宣告（key / 路由前綴 / 選單 / 依賴）＋ 開關，
//   關掉 = API 擋、選單藏、cron 跳過。組合靠開關不靠改碼。
//
// 儲存位置：fields.settings.modules[key] = true/false（jsonb，不動資料表結構）
//   沒設定 → 用這裡的 defaultEnabled（既有場域照「現在在用就開」的原則預設開啟）

export interface ModuleDef {
  key: string;
  label: string;
  /** 一句話說明：關掉會少掉什麼（設定頁直接顯示，不必另外寫文件） */
  description: string;
  /** 關掉時要擋的 API 路徑前綴（requireModule 依此掛載） */
  apiPrefixes: readonly string[];
  /** 關掉時要藏的後台選單路徑前綴 */
  menuPaths: readonly string[];
  /** 關掉時要跳過的排程（cron key） */
  crons?: readonly string[];
  /** 依賴的其他模組（依賴沒開 → 這個也視為關） */
  dependsOn?: readonly string[];
  /**
   * 舊的場域設定鍵（fields.settings.enableXxx）
   * 場域已經用舊開關關掉的，登錄表要照舊 —— 不能因為換新機制就把關掉的功能又打開
   */
  legacySettingKey?: string;
  /** 場域沒設定時的預設值 */
  defaultEnabled: boolean;
  /** 核心模組不可關（遊戲本體） */
  required?: boolean;
}

export const MODULE_REGISTRY: readonly ModuleDef[] = [
  {
    key: "games",
    label: "遊戲",
    description: "遊戲編輯、發布、玩家遊玩（平台核心，不能關）",
    apiPrefixes: ["/api/admin/games", "/api/games"],
    menuPaths: ["/admin/games"],
    defaultEnabled: true,
    required: true,
  },
  {
    key: "pos",
    label: "POS 收銀",
    description: "現場收款、品項管理、交班鎖帳、現金報表",
    apiPrefixes: ["/api/pos", "/api/admin/pos"],
    menuPaths: ["/pos", "/admin/pos"],
    defaultEnabled: true,
  },
  {
    key: "booking",
    label: "預約",
    description: "線上預約、今日預約名單、到場標記",
    apiPrefixes: ["/api/bookings", "/api/admin/bookings"],
    menuPaths: ["/admin/bookings"],
    crons: ["booking-reminder", "today-bookings"],
    defaultEnabled: true,
  },
  {
    key: "match",
    label: "競賽 / 接力",
    description: "玩家開賽事一起比成績、接力分段輪流玩",
    apiPrefixes: ["/api/matches"],
    menuPaths: [],
    legacySettingKey: "enableCompetitiveMode",
    defaultEnabled: true,
  },
  {
    key: "battle",
    label: "水彈對戰",
    description: "水彈場次報名、隊伍媒合、戰績",
    apiPrefixes: ["/api/battle", "/api/admin/battle"],
    menuPaths: ["/admin/battle"],
    crons: ["battle-scheduler"],
    legacySettingKey: "enableBattleArena",
    defaultEnabled: true,
  },
  {
    key: "squad",
    label: "小隊",
    description: "玩家永久隊伍、隊伍戰績與排行",
    apiPrefixes: ["/api/squads"],
    menuPaths: ["/admin/squads"],
    defaultEnabled: true,
  },
  {
    key: "rewards",
    label: "獎勵與券",
    description: "成就獎勵、優惠券、兌換碼",
    apiPrefixes: ["/api/admin/rewards", "/api/admin/coupon-templates", "/api/admin/redeem-codes"],
    menuPaths: ["/admin/rewards"],
    defaultEnabled: true,
  },
  {
    key: "devices",
    label: "硬體裝置",
    description: "現場感應裝置、MQTT 連線",
    apiPrefixes: ["/api/devices", "/api/admin/mqtt"],
    menuPaths: ["/admin/devices"],
    defaultEnabled: false,
  },
  {
    key: "host",
    label: "活動現場大螢幕",
    description:
      "主持人大螢幕 + 玩家手機互動（投票、詞雲、搶答…）。2026-09-25 起預設關閉：大螢幕互動改由 PhotoGo 提供，此模組只留給既有活動相容（super_admin 可對單一場域開）",
    apiPrefixes: ["/api/admin/host-sessions", "/api/host-sessions", "/api/trivia"],
    menuPaths: ["/admin/host-sessions"],
    dependsOn: ["games"],
    defaultEnabled: false,
  },
];

/**
 * 場域設定 → 各模組的實際開關值
 * 優先序：modules[key]（新）> 舊的 enableXxx 開關 > 登錄表預設值
 */
export function resolveFieldModules(settings: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const modules = (settings?.modules ?? {}) as Record<string, boolean>;
  const out: Record<string, boolean> = {};
  for (const def of MODULE_REGISTRY) {
    const legacy = def.legacySettingKey ? settings?.[def.legacySettingKey] : undefined;
    out[def.key] = modules[def.key] ?? (typeof legacy === "boolean" ? legacy : def.defaultEnabled);
  }
  return out;
}

export const MODULE_KEYS: readonly string[] = MODULE_REGISTRY.map((m) => m.key);

export function getModule(key: string): ModuleDef | undefined {
  return MODULE_REGISTRY.find((m) => m.key === key);
}

/** 場域設定（fields.settings.modules）→ 這個模組現在是開還是關 */
export function isModuleOn(modules: Record<string, boolean> | null | undefined, key: string): boolean {
  const def = getModule(key);
  if (!def) return true; // 不在登錄表的東西不擋（避免打錯字就整條路壞掉）
  if (def.required) return true;
  const self = modules?.[key] ?? def.defaultEnabled;
  if (!self) return false;
  // 依賴沒開 → 這個也算關（例：硬體關了，依賴硬體的模組就沒意義）
  return (def.dependsOn ?? []).every((dep) => isModuleOn(modules, dep));
}

/** 這個 API 路徑屬於哪個模組（最長前綴優先：/api/admin/games 比 /api/games 精準） */
export function moduleForApiPath(path: string): ModuleDef | undefined {
  let best: { def: ModuleDef; len: number } | undefined;
  for (const def of MODULE_REGISTRY) {
    for (const prefix of def.apiPrefixes) {
      if (path.startsWith(prefix) && (!best || prefix.length > best.len)) best = { def, len: prefix.length };
    }
  }
  return best?.def;
}

/** 後台選單項目是否要顯示（依路徑對到模組） */
export function isMenuPathOn(modules: Record<string, boolean> | null | undefined, path: string): boolean {
  const def = MODULE_REGISTRY.find((m) => m.menuPaths.some((p) => path.startsWith(p)));
  return def ? isModuleOn(modules, def.key) : true;
}

/** 這個排程在這個場域要不要跑 */
export function isCronOn(modules: Record<string, boolean> | null | undefined, cronKey: string): boolean {
  const def = MODULE_REGISTRY.find((m) => (m.crons ?? []).includes(cronKey));
  return def ? isModuleOn(modules, def.key) : true;
}
