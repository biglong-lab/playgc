// field_memberships service 單元測試
// 驗證授權 / 撤銷 / 暫停邏輯（不依賴 DB，mock 所有 db 呼叫）
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

function makeChainable(final: unknown) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    set: () => chain,
    values: () => chain, // 讓 .values().returning() 可行
    returning: () => Promise.resolve(Array.isArray(final) ? final : [final]),
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => Promise.resolve(final ?? []),
    limit: () => Promise.resolve(final ?? []),
  };
  return chain;
}

vi.mock("../db", () => ({
  db: {
    query: {
      fieldMemberships: {
        get findFirst() {
          return mockFindFirst;
        },
      },
      adminAccounts: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      roles: {
        findFirst: vi.fn(),
      },
      fields: {
        findFirst: vi.fn(),
      },
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return makeChainable({ id: "updated" });
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return makeChainable([{ id: "new-id" }]);
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return makeChainable([]);
    },
    select: () => makeChainable([]),
  },
}));

vi.mock("@shared/schema", () => ({
  fieldMemberships: { id: "id", userId: "userId", fieldId: "fieldId" },
  users: { id: "id" },
  roles: { id: "id" },
  fields: { id: "id" },
  adminAccounts: { id: "id", fieldId: "fieldId", firebaseUserId: "firebaseUserId" },
  adminSessions: { adminAccountId: "adminAccountId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

// Mock email service
const mockSendGranted = vi.fn().mockResolvedValue({ success: true });
const mockSendRevoked = vi.fn().mockResolvedValue({ success: true });
const mockSendSuspended = vi.fn().mockResolvedValue({ success: true });

vi.mock("../services/email", () => ({
  sendAdminGrantedEmail: (...args: unknown[]) => mockSendGranted(...args),
  sendAdminRevokedEmail: (...args: unknown[]) => mockSendRevoked(...args),
  sendPlayerSuspendedEmail: (...args: unknown[]) => mockSendSuspended(...args),
}));

// 現在載入被測模組
import { grantAdmin, revokeAdmin, suspendPlayer, ensureMembership } from "../services/field-memberships";
import { db } from "../db";

const mockAdminAccountsFind = (db.query.adminAccounts.findFirst as unknown) as ReturnType<typeof vi.fn>;
const mockUsersFind = (db.query.users.findFirst as unknown) as ReturnType<typeof vi.fn>;
const mockRolesFind = (db.query.roles.findFirst as unknown) as ReturnType<typeof vi.fn>;

describe("field-memberships service", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockInsert.mockReset();
    mockDelete.mockReset();
    mockAdminAccountsFind.mockReset();
    mockUsersFind.mockReset();
    mockRolesFind.mockReset();
    mockSendGranted.mockClear();
    mockSendRevoked.mockClear();
    mockSendSuspended.mockClear();
  });

  // ==========================================================================
  // ensureMembership
  // ==========================================================================
  describe("ensureMembership", () => {
    it("首次呼叫 → 建立新 membership", async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);

      const result = await ensureMembership("user-1", "field-1");

      expect(result).toBeDefined();
      expect(mockInsert).toHaveBeenCalled();
    });

    it("已存在 → 更新 lastActiveAt 不重複建立", async () => {
      const existing = { id: "m-1", userId: "user-1", fieldId: "field-1" };
      mockFindFirst.mockResolvedValueOnce(existing);

      const result = await ensureMembership("user-1", "field-1");

      expect(result).toEqual(existing);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // grantAdmin
  // ==========================================================================
  describe("grantAdmin", () => {
    it("角色不存在 → 回傳 error", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1" }); // ensureMembership existing
      mockRolesFind.mockResolvedValue(null);

      const result = await grantAdmin("user-1", "field-1", "role-bad", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("角色不存在");
    });

    it("跨場域角色 → 阻擋", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1" });
      mockRolesFind.mockResolvedValue({
        id: "role-other",
        fieldId: "other-field",
        name: "異場域角色",
      });

      const result = await grantAdmin("user-1", "field-1", "role-other", "admin-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("其他場域的角色");
    });

    it("成功授權 → 轉換 adminAccountId 為 firebaseUserId", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1" });
      mockRolesFind.mockResolvedValue({
        id: "role-1",
        fieldId: null, // 系統預設角色
        name: "場域主管",
      });
      mockAdminAccountsFind
        .mockResolvedValueOnce({ firebaseUserId: "firebase-admin-1" }) // granter lookup
        .mockResolvedValueOnce(null); // target admin_account lookup (none exists)
      mockUsersFind
        .mockResolvedValueOnce({ id: "user-1", email: "player@example.com" }); // target user lookup

      const result = await grantAdmin("user-1", "field-1", "role-1", "admin-account-id");

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("無真實 email 玩家 → 不寄信但成功", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1" });
      mockRolesFind.mockResolvedValue({ id: "role-1", fieldId: null, name: "角色" });
      mockAdminAccountsFind
        .mockResolvedValueOnce({ firebaseUserId: "firebase-admin-1" })
        .mockResolvedValueOnce(null);
      mockUsersFind.mockResolvedValueOnce({
        id: "user-1",
        email: "user-xxx@firebase.local", // fallback 假 email
      });

      const result = await grantAdmin("user-1", "field-1", "role-1", "admin-1");

      expect(result.success).toBe(true);
      expect(mockSendGranted).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // revokeAdmin
  // ==========================================================================
  describe("revokeAdmin", () => {
    it("成員不存在 → 回傳 error", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await revokeAdmin("user-ghost", "field-1", "admin-1");

      expect(result.success).toBe(false);
      expect(result.revokedSessions).toBe(0);
    });

    it("成功撤銷 → 更新 flag", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1", userId: "user-1" });
      mockAdminAccountsFind
        .mockResolvedValueOnce({ firebaseUserId: "firebase-1" }) // granter
        .mockResolvedValueOnce(null); // target admin_account
      mockUsersFind.mockResolvedValueOnce({ id: "user-1", email: "x@ex.com" });

      const result = await revokeAdmin("user-1", "field-1", "admin-1");

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // suspendPlayer
  // ==========================================================================
  describe("suspendPlayer", () => {
    it("成員不存在 → 回傳 error", async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await suspendPlayer("user-ghost", "field-1", "suspended");

      expect(result.success).toBe(false);
    });

    it("暫停成功 → 更新 status + notes", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1", notes: null });
      mockUsersFind.mockResolvedValueOnce({ id: "user-1", email: "x@ex.com" });

      const result = await suspendPlayer(
        "user-1",
        "field-1",
        "suspended",
        "違反規則"
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("恢復（active）→ 成功", async () => {
      mockFindFirst.mockResolvedValue({ id: "m-1" });
      mockUsersFind.mockResolvedValueOnce({ id: "user-1", email: "x@ex.com" });

      const result = await suspendPlayer("user-1", "field-1", "active");

      expect(result.success).toBe(true);
    });
  });
});
