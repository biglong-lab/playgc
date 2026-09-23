// 💳 方案功能目錄（P2 底座，2026-09-23；前後端共用）
//
// 背景：platform_plans.features 早就存著功能清單（battle_system、api_access…），
//   但程式從來沒讀 → 方案寫了什麼都一樣，升級沒有意義。
//
// 這支檔案把「功能鍵」變成有意義的東西：
//   - 後端：requireFeature() / 模組守門一起判斷（見 server/lib/field-plan.ts）
//   - 前端：方案頁顯示名稱與說明、被擋時的升級提示
//
// ⚠️ 原則跟模組一樣：判斷不出方案就放行，不能因為讀不到方案把客戶鎖死。

export interface PlanFeatureDef {
  key: string;
  label: string;
  description: string;
  /** 對應的模組（模組開著但方案沒這個功能 → 一樣擋） */
  moduleKey?: string;
  /** 目前還沒有程式接（列著讓方案頁顯示，不做執行時判斷） */
  notEnforced?: boolean;
}

export const PLAN_FEATURES: readonly PlanFeatureDef[] = [
  { key: "basic_games", label: "遊戲功能", description: "建立與發布互動遊戲" },
  { key: "qr_code", label: "QR Code", description: "產生遊戲 QR、現場掃碼進場" },
  { key: "redeem_code", label: "兌換碼", description: "發放與核銷兌換碼" },
  { key: "battle_system", label: "水彈對戰", description: "水彈場次報名、隊伍媒合、戰績", moduleKey: "battle" },
  { key: "ai_key_byo", label: "自帶 AI 金鑰", description: "填自己的 Gemini 金鑰跑 AI 出題與驗證" },
  { key: "custom_brand", label: "品牌外觀", description: "自訂場域主題色、Logo、歡迎訊息" },
  { key: "email_notify", label: "Email 通知", description: "預約、開通等信件通知" },
  { key: "line_notify", label: "LINE 通知", description: "LINE 官方帳號推播" },
  { key: "api_access", label: "外部 API", description: "用 API 金鑰串接自家系統（Public API v1）" },
  { key: "custom_domain", label: "自訂網域", description: "用自己的網域開場", notEnforced: true },
  { key: "white_label", label: "白牌", description: "移除平台品牌標示", notEnforced: true },
  { key: "priority_support", label: "優先支援", description: "優先客服回應", notEnforced: true },
];

export const PLAN_FEATURE_KEYS: readonly string[] = PLAN_FEATURES.map((f) => f.key);

export function getPlanFeature(key: string): PlanFeatureDef | undefined {
  return PLAN_FEATURES.find((f) => f.key === key);
}

/** 這個模組需要方案裡的哪個功能（沒有就是所有方案都能用） */
export function featureForModule(moduleKey: string): PlanFeatureDef | undefined {
  return PLAN_FEATURES.find((f) => f.moduleKey === moduleKey);
}

/**
 * 方案有沒有這個功能
 * features 讀不到（null / 空陣列）→ 一律放行（讀不到方案不能把客戶鎖死）
 */
export function planHasFeature(features: readonly string[] | null | undefined, key: string): boolean {
  if (!features || features.length === 0) return true;
  const def = getPlanFeature(key);
  if (def?.notEnforced) return true;
  return features.includes(key);
}

/** 被擋時給使用者看的訊息 */
export function featureUpgradeMessage(key: string): string {
  const def = getPlanFeature(key);
  return def
    ? `「${def.label}」需要升級方案才能使用（目前方案未包含）`
    : "這個功能需要升級方案才能使用";
}
