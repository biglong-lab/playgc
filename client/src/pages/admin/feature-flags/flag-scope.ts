// 🎚️ 元件開關的範圍判斷（2026-09-23 P0-B，與後端 admin-feature-flags.ts 規則一致）
//   - super_admin：可設全平台 + 任何場域
//   - 其他管理員：只能設 / 切「自己場域」的覆寫；全平台開關只能看

export type FlagScope = "global" | "field";

export interface FeatureFlag {
  id: string;
  scope: string;
  fieldId: string | null;
  moduleKey: string;
  enabled: boolean;
  disabledReason: string | null;
  disabledAt: string | null;
  disabledBy: string | null;
  metrics: { failRate?: number; total?: number; errored?: number } | null;
  updatedAt: string;
}

export interface FlagAdmin {
  systemRole: string;
  fieldId: string;
  fieldName?: string;
}

/** 等待確認的操作（確認框顯示影響範圍後才真的送出） */
export type PendingFlagAction =
  | { kind: "add"; moduleKey: string; scope: FlagScope }
  | { kind: "toggle"; flag: FeatureFlag; enabled: boolean };

export function isSuperAdmin(admin: FlagAdmin | null | undefined): boolean {
  return admin?.systemRole === "super_admin";
}

/** 這個管理員能不能切換這筆開關（看不到就打不到：跟後端 403 規則同源） */
export function canToggleFlag(flag: Pick<FeatureFlag, "scope" | "fieldId">, admin: FlagAdmin | null | undefined): boolean {
  if (!admin) return false;
  if (isSuperAdmin(admin)) return true;
  return flag.scope === "field" && flag.fieldId === admin.fieldId;
}

/** 影響範圍說明（確認框用） */
export function describeImpact(scope: string, fieldName: string | undefined): string {
  if (scope === "global") return "這會影響「所有場域」的玩家（全平台），請確認";
  return `只影響本場域「${fieldName || "目前場域"}」的玩家，其他場域不受影響`;
}

/** 列表「範圍」欄顯示文字 */
export function scopeLabel(flag: Pick<FeatureFlag, "scope" | "fieldId">, admin: FlagAdmin | null | undefined): string {
  if (flag.scope === "global") return "全平台";
  if (admin && flag.fieldId === admin.fieldId) return `本場域（${admin.fieldName || admin.fieldId}）`;
  return `場域 ${flag.fieldId?.slice(0, 8) ?? "?"}…`;
}

/** 確認框標題 */
export function pendingTitle(action: PendingFlagAction): string {
  if (action.kind === "add") return `新增「${action.moduleKey}」開關（預設關閉）`;
  return `${action.enabled ? "啟用" : "停用"}「${action.flag.moduleKey}」`;
}

export function pendingScope(action: PendingFlagAction): string {
  return action.kind === "add" ? action.scope : action.flag.scope;
}
