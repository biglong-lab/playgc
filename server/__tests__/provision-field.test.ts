// 🏗️ 開通場域：一條路建好場域 + 預設角色 + 訂閱 + 申請人帳號，並發事件
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, state } = vi.hoisted(() => {
  const state = {
    existingField: undefined as unknown,
    plan: { id: "plan-free", code: "free" } as unknown,
    permissions: [{ id: "p1", key: "game:view" }, { id: "p2", key: "session:manage" }] as unknown[],
    existingAccount: undefined as unknown,
    inserted: [] as { table: string; values: unknown }[],
  };
  const returningFor = (table: string) => {
    if (table === "fields") return [{ id: "field-new", code: "TEST", name: "測試場域" }];
    if (table === "roles") return [{ id: `role-${state.inserted.filter((i) => i.table === "roles").length}` }];
    if (table === "adminAccounts") return [{ id: "acc-new" }];
    return [{}];
  };
  const mockDb = {
    query: {
      fields: { findFirst: vi.fn(async () => state.existingField) },
      platformPlans: { findFirst: vi.fn(async () => state.plan) },
      adminAccounts: { findFirst: vi.fn(async () => state.existingAccount) },
    },
    select: vi.fn(() => ({ from: vi.fn(async () => state.permissions) })),
    insert: vi.fn((table: { _: { name?: string } } | string) => {
      const name = typeof table === "string" ? table : (table as { tableName?: string }).tableName ?? "unknown";
      return {
        values: vi.fn((values: unknown) => {
          state.inserted.push({ table: name, values });
          return { returning: vi.fn(async () => returningFor(name)) };
        }),
      };
    }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  };
  return { mockDb, state };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("@shared/schema", () => ({
  fields: { tableName: "fields", code: "code", id: "id" },
  roles: { tableName: "roles", fieldId: "field_id" },
  rolePermissions: { tableName: "rolePermissions" },
  permissions: { tableName: "permissions", id: "id", key: "key" },
  platformPlans: { tableName: "platformPlans", code: "code" },
  fieldSubscriptions: { tableName: "fieldSubscriptions" },
  adminAccounts: { tableName: "adminAccounts", fieldId: "field_id", email: "email", id: "id" },
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));

import { provisionField } from "../services/provision-field";
import { onEvent, resetEventBus } from "../lib/event-bus";

const base = { code: "test", name: "測試場域", source: "admin_create" as const };

beforeEach(() => {
  vi.clearAllMocks();
  resetEventBus();
  state.existingField = undefined;
  state.plan = { id: "plan-free", code: "free" };
  state.permissions = [{ id: "p1", key: "game:view" }, { id: "p2", key: "session:manage" }];
  state.existingAccount = undefined;
  state.inserted = [];
});

describe("provisionField", () => {
  it("代碼已被使用 → 409，不建任何東西", async () => {
    state.existingField = { id: "old" };
    const result = await provisionField(base);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(state.inserted).toEqual([]);
  });

  it("方案不存在 → 400", async () => {
    state.plan = undefined;
    expect(await provisionField({ ...base, planCode: "unknown" })).toMatchObject({ ok: false, status: 400 });
  });

  it("成功：建場域 + 兩個預設角色 + 訂閱（代碼自動轉大寫）", async () => {
    const result = await provisionField(base);
    expect(result.ok).toBe(true);
    const tables = state.inserted.map((i) => i.table);
    expect(tables).toContain("fields");
    expect(tables.filter((t) => t === "roles")).toHaveLength(2); // 場域管理員 + 活動執行者
    expect(tables).toContain("fieldSubscriptions");
    expect((state.inserted[0].values as { code: string }).code).toBe("TEST");
  });

  it("有申請人 email → 建場域管理員帳號並回傳 ID", async () => {
    const result = await provisionField({ ...base, source: "platform_approval", owner: { email: "Owner@Example.com ", displayName: "阿明" } });
    expect(result.ok && result.ownerAccountId).toBe("acc-new");
    const account = state.inserted.find((i) => i.table === "adminAccounts")?.values as { email: string; displayName: string };
    expect(account.email).toBe("owner@example.com"); // 轉小寫去空白
    expect(account.displayName).toBe("阿明");
  });

  it("沒有 email → 不建帳號（其他照常）", async () => {
    const result = await provisionField(base);
    expect(result.ok && result.ownerAccountId).toBeNull();
    expect(state.inserted.some((i) => i.table === "adminAccounts")).toBe(false);
  });

  it("試用天數 → 訂閱狀態 trial 並算出到期日；0 天 → active", async () => {
    await provisionField({ ...base, trialDays: 14 });
    const sub = state.inserted.find((i) => i.table === "fieldSubscriptions")?.values as { status: string; trialEndsAt: Date | null };
    expect(sub.status).toBe("trial");
    expect(sub.trialEndsAt).toBeInstanceOf(Date);
    state.inserted = [];
    await provisionField({ ...base, trialDays: 0 });
    const sub2 = state.inserted.find((i) => i.table === "fieldSubscriptions")?.values as { status: string };
    expect(sub2.status).toBe("active");
  });

  it("發出 field.provisioned 事件（含來源與方案）", async () => {
    const seen = vi.fn();
    onEvent("field.provisioned", seen);
    await provisionField({ ...base, source: "platform_approval", planCode: "free", owner: { email: "a@b.c" } });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({
      fieldId: "field-new", fieldCode: "TEST", planCode: "free", source: "platform_approval", ownerEmail: "a@b.c",
    }));
  });

  it("系統還沒有任何權限鍵 → 不建空角色（避免混淆）", async () => {
    state.permissions = [];
    const result = await provisionField(base);
    expect(result.ok && result.directorRoleId).toBeNull();
    expect(state.inserted.some((i) => i.table === "roles")).toBe(false);
  });
});
