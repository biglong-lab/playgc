/** 角色 */
export interface Role {
  id: string;
  name: string;
  systemRole: string;
}

/** 場域 */
export interface Field {
  id: string;
  code: string;
  name: string;
}

/** 管理員帳號 */
export interface AdminAccount {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  status: string;
  roleId: string | null;
  fieldId: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: Role | null;
  field: Field | null;
}

/** 帳號表單資料 */
export interface AccountFormData {
  username: string;
  password: string;
  displayName: string;
  email: string;
  roleId: string;
  fieldId: string;
}

/** 帳號狀態顯示對照 */
export const STATUS_LABELS: Record<string, string> = {
  active: "啟用中",
  inactive: "停用",
  locked: "鎖定",
  pending: "待授權",
};

/** 帳號狀態 Badge 樣式對照 */
export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> =
  {
    active: "default",
    inactive: "secondary",
    locked: "destructive",
    pending: "outline",
  };

/** 帶管理員認證的 fetch */
export async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { ...options, headers, credentials: "include" });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    // 🐛 2026-05-19：後端錯誤訊息可能在 message / error / details 任一個欄位、優先順序拿
    let msg = error.message || error.error || `HTTP ${response.status}`;
    // 🆕 validation 錯誤：把 zod details 展開成「欄位：原因」（原本只顯示 "validation"，看不出哪錯）
    if (error.error === "validation" && Array.isArray(error.details)) {
      const detail = error.details
        .map(
          (d: { path?: unknown[]; message?: string }) =>
            `${d.path?.join(".") || "?"}：${d.message}`,
        )
        .join("；");
      if (detail) msg = `欄位驗證失敗 — ${detail}`;
    }
    throw new Error(msg);
  }

  return response.json();
}

/** 格式化日期 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-TW");
}

/** 建立空白表單資料 */
export function createEmptyFormData(): AccountFormData {
  return {
    username: "",
    password: "",
    displayName: "",
    email: "",
    roleId: "",
    fieldId: "",
  };
}
