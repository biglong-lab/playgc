// ⏱️ 多人遊戲斷線寬限期設定規則（2026-09-23，前後端共用）
//
// 場域設定 fields.settings.disconnectGracePeriodSec / autoLeaveAfterGraceSec（單位：秒）
//   - 設定頁輸入範圍、設定 API 驗證、websocket 讀取時的合法判斷 共用同一份範圍
//   - 未設定 / 不合法 → server 用環境變數或內建預設

export const DISCONNECT_GRACE_LIMITS = {
  graceSec: { min: 5, max: 600, default: 30 },
  autoLeaveSec: { min: 30, max: 600, default: 120 },
} as const;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** 範圍內的有限數字 → 四捨五入整數秒；否則 undefined */
export function normalizeSeconds(value: unknown, range: Range): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const sec = Math.round(value);
  return sec >= range.min && sec <= range.max ? sec : undefined;
}

export interface DisconnectGraceValues {
  disconnectGracePeriodSec?: number;
  autoLeaveAfterGraceSec?: number;
}

export type DisconnectGraceCheck = { ok: true; values: DisconnectGraceValues } | { ok: false; message: string };

const FIELDS = [
  { key: "disconnectGracePeriodSec", range: DISCONNECT_GRACE_LIMITS.graceSec, label: "斷線寬限期" },
  { key: "autoLeaveAfterGraceSec", range: DISCONNECT_GRACE_LIMITS.autoLeaveSec, label: "超時自動離開" },
] as const;

/** 設定 API 驗證：有帶才檢查；不合法回繁中訊息 */
export function checkDisconnectGraceSettings(body: Record<string, unknown>): DisconnectGraceCheck {
  const values: DisconnectGraceValues = {};
  for (const { key, range, label } of FIELDS) {
    if (body[key] === undefined) continue;
    const sec = normalizeSeconds(body[key], range);
    if (sec === undefined) return { ok: false, message: `${label}需介於 ${range.min}～${range.max} 秒` };
    values[key] = sec;
  }
  return { ok: true, values };
}
