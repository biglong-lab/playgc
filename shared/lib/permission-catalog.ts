// 🔑 權限鍵目錄（P2 底座，2026-09-23；前後端共用的單一真相）
//
// 背景（通盤規劃盤點）：權限顆粒太粗 —— 預約、POS、營收全掛在 game:edit / game:view，
//   沒辦法建「只做 POS」「只看報表」這種角色；而且有程式用了卻沒在 permissions 表建的鍵。
//
// 這支檔案是唯一來源：
//   - 伺服器啟動時依此補齊 permissions 表（只加不刪，見 server/services/ensure-permissions.ts）
//   - 守護測試：程式裡 requirePermission() 用到的鍵，一定要出現在這裡（否則永遠授不出去）
//   - 後台角色編輯頁照這個分類顯示
//
// ⚠️ 換檢查分兩步（規劃：「先只加遷移再換檢查」）：
//   第一步（本批）：新鍵建好 + 依對照表補發給既有角色 → 沒有人掉權限
//   第二步（下一批）：路由的 requirePermission 從 game:edit 換成新鍵

export interface PermissionDef {
  key: string;
  name: string;
  description: string;
  category: "game" | "content" | "operations" | "booking" | "pos" | "revenue" | "user" | "admin" | "field" | "qr";
}

export const PERMISSION_CATALOG: readonly PermissionDef[] = [
  // 遊戲
  { key: "game:view", name: "檢視遊戲", description: "看得到遊戲列表與內容", category: "game" },
  { key: "game:create", name: "建立遊戲", description: "新增遊戲", category: "game" },
  { key: "game:edit", name: "編輯遊戲", description: "修改遊戲與頁面內容", category: "game" },
  { key: "game:publish", name: "發布遊戲", description: "把遊戲上架給玩家", category: "game" },
  { key: "game:delete", name: "刪除遊戲", description: "刪除遊戲", category: "game" },
  // 內容
  { key: "page:view", name: "檢視頁面", description: "看得到遊戲頁面設定", category: "content" },
  { key: "page:edit", name: "編輯頁面", description: "修改遊戲頁面設定", category: "content" },
  { key: "item:view", name: "檢視道具", description: "看得到道具", category: "content" },
  { key: "item:edit", name: "編輯道具", description: "修改道具", category: "content" },
  // 現場營運
  { key: "session:manage", name: "管理遊戲場次", description: "重設 / 結束玩家場次", category: "operations" },
  { key: "leaderboard:view", name: "檢視排行榜", description: "看得到排行榜", category: "operations" },
  { key: "qr:view", name: "檢視 QR Code", description: "看得到遊戲 QR", category: "qr" },
  { key: "qr:generate", name: "產生 QR Code", description: "重新產生遊戲 QR", category: "qr" },
  { key: "qr:scan_check", name: "現場 QR 查驗", description: "掃描驗證票券 / 報到", category: "operations" },
  // 預約
  { key: "booking:view_today", name: "查看今日預約", description: "看得到今天的預約名單", category: "booking" },
  { key: "booking:mark_attended", name: "標記到場", description: "把預約標成已到場", category: "booking" },
  { key: "booking:manage", name: "管理預約", description: "建立 / 改期 / 取消預約（後台）", category: "booking" },
  // POS
  { key: "pos:view", name: "POS 工作站", description: "進得去 POS 首頁", category: "pos" },
  { key: "pos:scan", name: "POS 掃描核銷", description: "掃描票券 / 報到", category: "pos" },
  { key: "pos:checkout", name: "POS 現金收款", description: "收款結帳", category: "pos" },
  { key: "pos:voucher_redeem", name: "POS 券核銷", description: "核銷優惠券", category: "pos" },
  { key: "pos:operate", name: "POS 現場操作", description: "現場人員的日常操作（收款、掃描、今日預約）", category: "pos" },
  { key: "pos:manage", name: "POS 設定管理", description: "品項、加購、垃圾桶等 POS 設定", category: "pos" },
  { key: "pos_cash_admin", name: "POS 現金管理", description: "交班鎖帳、現金差異、現金報表", category: "pos" },
  // 營收 / 報表
  { key: "revenue:view", name: "檢視營收", description: "看得到營收與交易金額", category: "revenue" },
  { key: "report:view", name: "檢視營運報表", description: "看得到場次 / 遊玩 / 健康度報表", category: "revenue" },
  // 人員
  { key: "user:view", name: "檢視使用者", description: "看得到玩家與帳號列表", category: "user" },
  { key: "user:manage", name: "管理使用者", description: "編輯玩家資料 / 停用帳號", category: "user" },
  { key: "user:manage_roles", name: "管理角色", description: "建立角色、指派權限", category: "user" },
  // 後台 / 場域
  { key: "admin:manage_accounts", name: "管理後台帳號", description: "新增 / 停用後台帳號", category: "admin" },
  { key: "admin:view_audit", name: "檢視稽核紀錄", description: "看得到後台操作紀錄", category: "admin" },
  { key: "field:manage", name: "管理場域", description: "場域資料與設定", category: "field" },
];

export const PERMISSION_KEYS: readonly string[] = PERMISSION_CATALOG.map((p) => p.key);

export function isKnownPermission(key: string): boolean {
  return PERMISSION_KEYS.includes(key);
}

/**
 * 新鍵的補發對照（只加不減）
 * 規則：某角色原本有 `when` 這個鍵 → 補發 `grant` 這些新鍵，
 *       這樣之後把路由檢查換成新鍵時，現有角色不會突然打不開。
 */
export const PERMISSION_BACKFILL: readonly { when: string; grant: readonly string[] }[] = [
  // 預約後台目前掛 game:edit
  { when: "game:edit", grant: ["booking:manage", "pos:manage"] },
  // 報表頁目前掛 game:view；營收金額目前也只看 game:view
  { when: "game:view", grant: ["report:view", "revenue:view"] },
  // 現金管理本來就是財務角色 → 一併給現場操作與營收檢視
  { when: "pos_cash_admin", grant: ["pos:operate", "revenue:view", "report:view"] },
  // 現場人員（有 POS 收款 / 掃描的）→ 給統一的現場操作鍵
  { when: "pos:checkout", grant: ["pos:operate"] },
  { when: "pos:scan", grant: ["pos:operate"] },
  // 原本能管角色的，也能管使用者
  { when: "user:manage_roles", grant: ["user:manage"] },
];
