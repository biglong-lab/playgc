// 🗑️ POS 垃圾桶 — 已刪除的現金支出要看得到、可還原
//   - 支出刪除是軟刪除（deleted_at），但垃圾桶 API 過去沒列支出、還原也不支援 → 刪了就找不回
//   - 還原會改變當日現金 → 該日已交班鎖帳就擋（與刪除的鎖帳保護一致）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { posExpenses } from "@shared/schema";

const { state, mockDb, mockAudit, mockGetSettlement, mockScope } = vi.hoisted(() => {
  const state = {
    rowsByTable: new Map<unknown, unknown[]>(),
    updateReturning: [] as unknown[],
    updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  };
  function query(table: unknown) {
    const q: Record<string, unknown> = {};
    for (const m of ["where", "orderBy", "limit"]) q[m] = vi.fn(() => q);
    q.then = (resolve: (v: unknown[]) => unknown) => resolve(state.rowsByTable.get(table) ?? []);
    return q;
  }
  const mockDb = {
    select: vi.fn(() => ({ from: vi.fn((table: unknown) => query(table)) })),
    update: vi.fn((table: unknown) => {
      const u: Record<string, unknown> = {};
      u.set = vi.fn((values: Record<string, unknown>) => {
        state.updates.push({ table, values });
        return u;
      });
      u.where = vi.fn(() => u);
      u.returning = vi.fn(async () => state.updateReturning);
      u.then = (resolve: (v: unknown) => unknown) => resolve(undefined);
      return u;
    }),
  };
  return {
    state,
    mockDb,
    mockAudit: vi.fn(),
    mockGetSettlement: vi.fn(),
    mockScope: vi.fn(),
  };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../routes/pos", () => ({ resolveFieldScope: mockScope }));
vi.mock("../routes/pos-cash", () => ({ getSettlement: mockGetSettlement }));

// 🔒 2026-09-23 安全審查 M7：現金支出還原要財務權限（pos_cash_admin），個別測試可改這個變數
let mockAdminPermissions: string[] = ["game:edit", "pos_cash_admin"];

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    req.admin = { id: "admin-1", fieldId: "field-uuid", systemRole: "field_director", permissions: mockAdminPermissions };
    return next();
  }),
  requirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  logAuditAction: mockAudit,
}));

import { registerAdminPosProductRoutes } from "../routes/admin-pos-products";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminPosProductRoutes(app);
  return app;
}

const DELETED_EXPENSE = {
  id: "exp-1", fieldId: "field-uuid", businessDate: "2026-09-22", category: "採購", amountCents: 35_000,
  note: "買冰塊", deletedAt: "2026-09-22T10:00:00.000Z", deletedBy: "admin-2", deleteReason: "重複記帳",
};

describe("POS 垃圾桶 — 現金支出", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rowsByTable.clear();
    state.updates.length = 0;
    state.updateReturning = [];
    mockScope.mockResolvedValue({ id: "field-uuid", code: "JIACHUN", identifiers: ["field-uuid", "JIACHUN"] });
    mockGetSettlement.mockResolvedValue(null);
  });

  it("GET /api/admin/pos/trash → 回傳已刪除的支出", async () => {
    state.rowsByTable.set(posExpenses, [DELETED_EXPENSE]);
    const res = await request(createApp()).get("/api/admin/pos/trash");
    expect(res.status).toBe(200);
    expect(res.body.expenses).toEqual([DELETED_EXPENSE]);
  });

  it("GET 垃圾桶在無法解析場域時，支出回空陣列而非 500", async () => {
    mockScope.mockResolvedValue(null);
    const res = await request(createApp()).get("/api/admin/pos/trash");
    expect(res.status).toBe(200);
    expect(res.body.expenses).toEqual([]);
  });

  it("POST restore type=expense → 清除刪除標記並記稽核", async () => {
    state.rowsByTable.set(posExpenses, [DELETED_EXPENSE]);
    state.updateReturning = [{ ...DELETED_EXPENSE, deletedAt: null }];
    const res = await request(createApp()).post("/api/admin/pos/restore").send({ type: "expense", id: "exp-1" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(state.updates).toEqual([
      { table: posExpenses, values: { deletedAt: null, deletedBy: null, deleteReason: null } },
    ]);
    expect(mockGetSettlement).toHaveBeenCalledWith(["field-uuid", "JIACHUN"], "2026-09-22");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pos:expense_restore", targetType: "pos_expense", targetId: "exp-1" }),
    );
  });

  it("還原的支出不存在（或不是本場域 / 未被刪除）→ 404 不更新", async () => {
    const res = await request(createApp()).post("/api/admin/pos/restore").send({ type: "expense", id: "nope" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBeTruthy();
    expect(state.updates).toHaveLength(0);
  });

  it("該日已交班鎖帳 → 409 不還原（避免改動已鎖定的帳）", async () => {
    state.rowsByTable.set(posExpenses, [DELETED_EXPENSE]);
    mockGetSettlement.mockResolvedValue({ id: "st-1" });
    const res = await request(createApp()).post("/api/admin/pos/restore").send({ type: "expense", id: "exp-1" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("locked");
    expect(res.body.message).toContain("交班鎖帳");
    expect(state.updates).toHaveLength(0);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("未知 type → 仍回 400", async () => {
    const res = await request(createApp()).post("/api/admin/pos/restore").send({ type: "weird", id: "x" });
    expect(res.status).toBe(400);
  });

  // 🔒 2026-09-23 安全審查 M7
  it("只有內容編輯權、沒有現金管理權 → 403 不還原（現金支出影響當日對帳）", async () => {
    mockAdminPermissions = ["game:edit"];
    try {
      const res = await request(createApp()).post("/api/admin/pos/restore").send({ type: "expense", id: "exp-1" });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("現金管理權限");
    } finally {
      mockAdminPermissions = ["game:edit", "pos_cash_admin"];
    }
  });
});
