// 📣 領域事件定義（P2 底座，2026-09-23；前後端共用型別）
//
// 規則（hung-blocks L1）：
//   - 事件是「已經發生的事實」，用過去式命名（field.provisioned 不是 provisionField）
//   - payload 只放識別碼與少量必要資訊，訂閱者要細節自己去查（避免事件變成另一份資料副本）
//   - 加欄位自由、改語意要走契約變更流程

export interface FieldProvisionedEvent {
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  planCode: string;
  /** 從哪裡開通的：平台審核申請 / 後台直接建立 */
  source: "platform_approval" | "admin_create";
  /** 申請來源的經銷代碼（P3 經銷夥伴會用；目前可能為 null） */
  partnerCode?: string | null;
  /** 開通時建立的場域管理員帳號（沒有 email 就不會建） */
  ownerAccountId?: string | null;
  ownerEmail?: string | null;
  trialEndsAt?: string | null;
  occurredAt: string;
}
