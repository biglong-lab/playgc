// 時段關閉 / 包場（closures）server 端驗證 + 蓋章（2026-07-02）
//
// 集中「原因必填」等驗證（防前端被繞過），並替新 closure 蓋章設定帳號/時間。
import type { BookingScheduleTemplate, BookingClosure } from "@shared/schema";

/** 驗證失敗 → 400（handler 轉成回應）*/
export class ClosureValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ClosureValidationError";
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set(["holiday", "private_booking", "maintenance", "event", "other"]);
const VALID_SCOPES = new Set(["full_day", "time_range"]);

/** 設定人（req.admin 的子集，結構相容 AdminPrincipal）*/
export interface ClosureActor {
  id: string;
  displayName: string | null;
  username: string;
}

/**
 * 驗證每筆 closure、替「新」closure（無 createdByAdminId）蓋章設定帳號/時間。
 * 既有 closure 保留原蓋章不覆寫。
 * @throws ClosureValidationError 驗證失敗（reason 空、time_range 起訖不合法等）
 */
export function validateAndStampClosures(
  template: BookingScheduleTemplate,
  actor: ClosureActor | undefined,
): { template: BookingScheduleTemplate; newClosureCount: number } {
  const closures = template.closures;
  if (!closures || closures.length === 0) {
    return { template, newClosureCount: 0 };
  }

  const nowIso = new Date().toISOString();
  let newCount = 0;

  const stamped: BookingClosure[] = closures.map((c, i) => {
    const at = `第 ${i + 1} 筆關閉設定`;
    if (!c.id || typeof c.id !== "string") throw new ClosureValidationError(`${at}：缺少 id`);
    if (!c.date || !YMD.test(c.date)) throw new ClosureValidationError(`${at}：日期格式須為 YYYY-MM-DD`);
    if (!VALID_SCOPES.has(c.scope)) throw new ClosureValidationError(`${at}：範圍無效`);
    if (!VALID_TYPES.has(c.type)) throw new ClosureValidationError(`${at}：類型無效`);
    if (!c.reason || !c.reason.trim()) throw new ClosureValidationError(`${at}：請填寫原因備註`);

    if (c.scope === "time_range") {
      if (!c.startTime || !c.endTime || !HHMM.test(c.startTime) || !HHMM.test(c.endTime)) {
        throw new ClosureValidationError(`${at}：指定時段需填合法起訖時間（HH:mm）`);
      }
      if (c.startTime >= c.endTime) {
        throw new ClosureValidationError(`${at}：結束時間需晚於開始時間`);
      }
    }

    const reason = c.reason.trim();
    // 既有 closure（已蓋章）→ 保留、只清理 reason
    if (c.createdByAdminId) {
      return { ...c, reason };
    }
    // 新 closure → 蓋章設定帳號 + 時間
    newCount += 1;
    const base: BookingClosure = {
      ...c,
      reason,
      createdByAdminId: actor?.id,
      createdByName: actor ? actor.displayName ?? actor.username : undefined,
      createdAt: nowIso,
    };
    // full_day 不保留 start/end（清乾淨）
    if (c.scope === "full_day") {
      delete base.startTime;
      delete base.endTime;
    }
    return base;
  });

  return { template: { ...template, closures: stamped }, newClosureCount: newCount };
}
