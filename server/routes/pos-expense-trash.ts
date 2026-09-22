// 🗑️ POS 垃圾桶：現金支出（2026-09-23）
//
// 支出刪除是軟刪除（pos-cash.ts POST /api/pos/expenses/:id/delete 寫 deleted_at / deleted_by / delete_reason），
// 這裡提供垃圾桶列表與還原給 admin-pos-products 的 /api/admin/pos/trash、/api/admin/pos/restore 使用。
// 支出以 resolveFieldScope 的 id / code 兩種識別存放（與 pos-cash 一致）。
import type { Request } from "express";
import { db } from "../db";
import { posExpenses } from "@shared/schema";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { logAuditAction } from "../adminAuth";
import { resolveFieldScope } from "./pos";
import { getSettlement } from "./pos-cash";

const TRASH_LIMIT = 200;
const IS_DELETED = sql`${posExpenses.deletedAt} IS NOT NULL`;

export interface TrashActionResult {
  status: number;
  body: Record<string, unknown>;
}

/** 列本場域已刪除的支出（新 → 舊）；場域解析不到回空陣列 */
export async function listDeletedExpenses(req: Request) {
  const scope = await resolveFieldScope(req);
  if (!scope) return [];
  return db
    .select()
    .from(posExpenses)
    .where(and(inArray(posExpenses.fieldId, scope.identifiers), IS_DELETED))
    .orderBy(desc(posExpenses.deletedAt))
    .limit(TRASH_LIMIT);
}

/** 還原已刪除的支出；該日已交班鎖帳則擋（還原會改變已鎖定的現金） */
export async function restoreDeletedExpense(req: Request, id: string): Promise<TrashActionResult> {
  const scope = await resolveFieldScope(req);
  if (!scope) return { status: 400, body: { error: "no_field", message: "無法判斷場域" } };
  const owned = and(eq(posExpenses.id, id), inArray(posExpenses.fieldId, scope.identifiers), IS_DELETED);

  const [target] = await db.select().from(posExpenses).where(owned).limit(1);
  if (!target) return { status: 404, body: { error: "not_found", message: "找不到已刪除的支出" } };

  if (await getSettlement(scope.identifiers, target.businessDate)) {
    return {
      status: 409,
      body: { error: "locked", message: `${target.businessDate} 已交班鎖帳，無法還原支出（如需更正請由管理員調整）` },
    };
  }

  const [restored] = await db
    .update(posExpenses)
    .set({ deletedAt: null, deletedBy: null, deleteReason: null })
    .where(owned)
    .returning();
  if (!restored) return { status: 404, body: { error: "not_found", message: "找不到已刪除的支出" } };

  await logAuditAction({
    actorAdminId: req.admin!.id,
    action: "pos:expense_restore",
    targetType: "pos_expense",
    targetId: id,
    fieldId: scope.id,
    metadata: { businessDate: target.businessDate, amountCents: target.amountCents, category: target.category },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
  return { status: 200, body: { ok: true } };
}
