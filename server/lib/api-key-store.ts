// 🔑 API Key Store — API key metadata 抽象層（W12 D1）
//
// 用途：取代既有「逗號分隔 API_KEYS」純字串、加入 metadata
//
// 設計：
//   - 來源優先序：API_KEYS_JSON（含 metadata）> API_KEYS（純字串，向下相容）
//   - 此層為「純函式 + in-memory cache」，未來可換 DB（W12 D5 / Phase 4）
//
// API_KEYS_JSON 格式：
//   [
//     { "key": "ck_test_xxx", "label": "Wedding Co.", "fieldId": "field_jc_jiacun", "quota": 50 },
//     { "key": "ck_live_yyy", "label": "Tour Agency", "fieldId": "field_taipei", "quota": 200 }
//   ]

export interface ApiKeyMetadata {
  /** Bearer token（ck_test_* / ck_live_*）*/
  key: string;
  /** 標籤（顯示用，如代理商名稱）*/
  label: string;
  /** 對應場域 ID */
  fieldId: string | null;
  /** 月配額（建場上限），null = 無限 */
  quota: number | null;
  /** 是否為測試 key */
  isTest: boolean;
  /** 是否啟用（false 視為已撤銷）*/
  active: boolean;
}

let cache: Map<string, ApiKeyMetadata> | null = null;

/** 解析環境變數，建立 in-memory map（lazy + cached）*/
function loadApiKeys(): Map<string, ApiKeyMetadata> {
  if (cache) return cache;
  const map = new Map<string, ApiKeyMetadata>();

  // 1. 優先讀 API_KEYS_JSON（含 metadata）
  const json = process.env.API_KEYS_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Array<Partial<ApiKeyMetadata> & { key: string }>;
      for (const entry of parsed) {
        if (!entry.key) continue;
        const isTest = entry.key.startsWith("ck_test_");
        map.set(entry.key, {
          key: entry.key,
          label: entry.label || maskKey(entry.key),
          fieldId: entry.fieldId ?? null,
          quota: entry.quota ?? null,
          isTest,
          active: entry.active !== false,
        });
      }
    } catch (err) {
      console.error("[api-key-store] API_KEYS_JSON 解析失敗:", err);
    }
  }

  // 2. 向下相容：API_KEYS（純字串）+ API_KEY_FIELD_<...> + API_KEY_DEFAULT_FIELD
  const legacyKeys = (process.env.API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
  const defaultField = process.env.API_KEY_DEFAULT_FIELD || null;
  for (const key of legacyKeys) {
    if (map.has(key)) continue; // 已從 JSON 載入
    const isTest = key.startsWith("ck_test_");
    const shortKey = maskKey(key).slice(0, 8).replace(/[^a-zA-Z0-9_]/g, "_");
    const fieldId = process.env[`API_KEY_FIELD_${shortKey}`] || defaultField;
    map.set(key, {
      key,
      label: maskKey(key),
      fieldId,
      quota: null, // legacy 無 quota
      isTest,
      active: true,
    });
  }

  cache = map;
  return map;
}

/** 強制刷新 cache（測試 / 環境變數變更後用）*/
export function reloadApiKeys(): void {
  cache = null;
}

/** 找一個 API key 的 metadata；找不到回 null */
export function findApiKey(key: string): ApiKeyMetadata | null {
  const map = loadApiKeys();
  const entry = map.get(key);
  if (!entry || !entry.active) return null;
  return entry;
}

/** 列出所有有效 keys（admin 用）*/
export function listApiKeys(): ApiKeyMetadata[] {
  const map = loadApiKeys();
  return Array.from(map.values()).filter((e) => e.active);
}

/** 統計（健康檢查 / dashboard 用）*/
export function getApiKeyStats(): {
  total: number;
  active: number;
  test: number;
  live: number;
} {
  const all = Array.from(loadApiKeys().values());
  return {
    total: all.length,
    active: all.filter((e) => e.active).length,
    test: all.filter((e) => e.isTest).length,
    live: all.filter((e) => !e.isTest).length,
  };
}

/** masked key 顯示（log / UI 用）*/
function maskKey(key: string): string {
  if (key.length < 12) return "***";
  return `${key.slice(0, 8)}***${key.slice(-3)}`;
}
