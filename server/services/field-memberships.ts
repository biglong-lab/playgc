// 🎫 場域會員身份服務 — 授權 / 撤銷 / 查詢
// 核心原則：所有操作必須限定 fieldId，不跨場域查詢
import { db } from "../db";
import {
  fieldMemberships,
  users,
  roles,
  fields,
  adminAccounts,
  adminSessions,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  sendAdminGrantedEmail,
  sendAdminRevokedEmail,
  sendPlayerSuspendedEmail,
} from "./email";

function formatUserName(
  user: { firstName: string | null; lastName: string | null; email: string | null } | null | undefined
): string {
  if (!user) return "使用者";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  return user.email ?? "使用者";
}

/**
 * 從 admin_accounts.id 換到 users.id（Firebase UID）
 * FK 限制：field_memberships.admin_granted_by → users.id
 * 若 admin 沒綁 Firebase（legacy）則回 null
 */
async function adminAccountIdToUserId(
  adminAccountId: string | undefined | null
): Promise<string | null> {
  if (!adminAccountId) return null;
  const account = await db.query.adminAccounts.findFirst({
    where: eq(adminAccounts.id, adminAccountId),
    columns: { firebaseUserId: true },
  });
  return account?.firebaseUserId ?? null;
}

export interface MembershipSummary {
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  joinedAt: Date;
  isAdmin: boolean;
  adminRoleId: string | null;
  adminRoleName: string | null;
  playerStatus: string;
}

// ============================================================================
// 查詢
// ============================================================================

/**
 * 取得玩家在所有場域的會員身份（玩家端自我查詢用）
 * 注意：這個端點給登入玩家看自己的，不會洩漏他人資料
 */
export async function getMembershipsForUser(userId: string): Promise<MembershipSummary[]> {
  const rows = await db
    .select({
      fieldId: fieldMemberships.fieldId,
      fieldCode: fields.code,
      fieldName: fields.name,
      joinedAt: fieldMemberships.joinedAt,
      isAdmin: fieldMemberships.isAdmin,
      adminRoleId: fieldMemberships.adminRoleId,
      adminRoleName: roles.name,
      playerStatus: fieldMemberships.playerStatus,
    })
    .from(fieldMemberships)
    .leftJoin(fields, eq(fields.id, fieldMemberships.fieldId))
    .leftJoin(roles, eq(roles.id, fieldMemberships.adminRoleId))
    .where(eq(fieldMemberships.userId, userId));

  return rows.map((r) => ({
    fieldId: r.fieldId,
    fieldCode: r.fieldCode ?? "",
    fieldName: r.fieldName ?? "",
    joinedAt: r.joinedAt ?? new Date(),
    isAdmin: r.isAdmin,
    adminRoleId: r.adminRoleId,
    adminRoleName: r.adminRoleName,
    playerStatus: r.playerStatus,
  }));
}

/**
 * 列出單一場域的所有成員（管理員端用，已隔離）
 * @param fieldId 呼叫者的場域 ID（由 middleware 注入，不可跨場域）
 * @param filter 可選篩選：is_admin / status
 */
export async function listFieldMembers(
  fieldId: string,
  filter?: { isAdmin?: boolean; playerStatus?: string }
) {
  const conditions = [eq(fieldMemberships.fieldId, fieldId)];
  if (filter?.isAdmin !== undefined) {
    conditions.push(eq(fieldMemberships.isAdmin, filter.isAdmin));
  }
  if (filter?.playerStatus) {
    conditions.push(eq(fieldMemberships.playerStatus, filter.playerStatus));
  }

  return db
    .select({
      membership: fieldMemberships,
      user: users,
      role: roles,
    })
    .from(fieldMemberships)
    .leftJoin(users, eq(users.id, fieldMemberships.userId))
    .leftJoin(roles, eq(roles.id, fieldMemberships.adminRoleId))
    .where(and(...conditions))
    .orderBy(desc(fieldMemberships.joinedAt));
}

/**
 * 取得單一玩家在指定場域的 membership（用於授權前檢查）
 */
export async function getMembership(userId: string, fieldId: string) {
  return db.query.fieldMemberships.findFirst({
    where: and(
      eq(fieldMemberships.userId, userId),
      eq(fieldMemberships.fieldId, fieldId)
    ),
  });
}

// ============================================================================
// 自動加入（玩家首次進入場域時）
// ============================================================================

/**
 * 確保玩家在場域有 membership（首次會自動建立）
 * 冪等操作：已存在則僅更新 last_active_at
 */
export async function ensureMembership(userId: string, fieldId: string) {
  const existing = await getMembership(userId, fieldId);
  if (existing) {
    // 更新最後活躍時間
    await db
      .update(fieldMemberships)
      .set({ lastActiveAt: new Date() })
      .where(eq(fieldMemberships.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(fieldMemberships)
    .values({
      userId,
      fieldId,
      playerStatus: "active",
      isAdmin: false,
    })
    .returning();
  return created;
}

// ============================================================================
// 管理員授權開關
// ============================================================================

/**
 * 授權玩家成為該場域管理員（開關 ON）
 * @param userId 被授權的使用者
 * @param fieldId 場域 ID（必須等於呼叫者的 fieldId）
 * @param roleId 要授與的角色
 * @param grantedBy 授權人的 user id
 */
export async function grantAdmin(
  userId: string,
  fieldId: string,
  roleId: string,
  grantedByAccountId: string
): Promise<{ success: boolean; error?: string }> {
  // 確保有 membership（無則建立）
  await ensureMembership(userId, fieldId);

  // 驗證 role 屬於該場域或系統預設
  const role = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
  });
  if (!role) {
    return { success: false, error: "角色不存在" };
  }
  if (role.fieldId && role.fieldId !== fieldId) {
    return { success: false, error: "無法指派其他場域的角色" };
  }

  // 把 admin_accounts.id 轉成 users.id（FK 限制）
  const grantedByUserId = await adminAccountIdToUserId(grantedByAccountId);

  await db
    .update(fieldMemberships)
    .set({
      isAdmin: true,
      adminRoleId: roleId,
      adminGrantedAt: new Date(),
      adminGrantedBy: grantedByUserId, // null-safe（若 admin 未綁 Firebase 則存 null）
      adminRevokedAt: null,
      adminRevokedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fieldMemberships.userId, userId),
        eq(fieldMemberships.fieldId, fieldId)
      )
    );

  // 同步寫入 admin_accounts（向後相容，JWT 登入仍讀這張表）
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.email) {
    const existing = await db.query.adminAccounts.findFirst({
      where: and(
        eq(adminAccounts.fieldId, fieldId),
        eq(adminAccounts.firebaseUserId, userId)
      ),
    });
    if (existing) {
      await db
        .update(adminAccounts)
        .set({
          roleId,
          status: "active",
          email: user.email,
          updatedAt: new Date(),
        })
        .where(eq(adminAccounts.id, existing.id));
    } else {
      await db.insert(adminAccounts).values({
        fieldId,
        firebaseUserId: userId,
        email: user.email,
        displayName:
          user.firstName || user.lastName
            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
            : user.email,
        roleId,
        status: "active",
      });
    }
  }

  // 📧 發通知信（真實 email 才寄；fallback user 不打擾）
  if (user?.email && !user.email.endsWith("@firebase.local")) {
    const field = await db.query.fields.findFirst({ where: eq(fields.id, fieldId) });
    const grantor = grantedByUserId
      ? await db.query.users.findFirst({ where: eq(users.id, grantedByUserId) })
      : null;
    sendAdminGrantedEmail({
      to: user.email,
      recipientName: formatUserName(user),
      fieldName: field?.name ?? "場域",
      roleName: role.name,
      grantedByName: formatUserName(grantor ?? null),
    }).catch((err) => console.error("[email] sendAdminGrantedEmail 失敗:", err));
  }

  return { success: true };
}

/**
 * 撤銷管理員授權（開關 OFF）— 立即使所有 JWT session 失效
 */
export async function revokeAdmin(
  userId: string,
  fieldId: string,
  revokedByAccountId: string
): Promise<{ success: boolean; error?: string; revokedSessions: number }> {
  const membership = await getMembership(userId, fieldId);
  if (!membership) {
    return { success: false, error: "該玩家並非此場域成員", revokedSessions: 0 };
  }

  const revokedByUserId = await adminAccountIdToUserId(revokedByAccountId);

  await db
    .update(fieldMemberships)
    .set({
      isAdmin: false,
      adminRevokedAt: new Date(),
      adminRevokedBy: revokedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(fieldMemberships.id, membership.id));

  // 同步停用 admin_accounts
  const adminAccount = await db.query.adminAccounts.findFirst({
    where: and(
      eq(adminAccounts.fieldId, fieldId),
      eq(adminAccounts.firebaseUserId, userId)
    ),
  });

  let revokedSessions = 0;
  if (adminAccount) {
    await db
      .update(adminAccounts)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(adminAccounts.id, adminAccount.id));

    // 立即刪除該 admin 的所有 JWT session
    const deleted = await db
      .delete(adminSessions)
      .where(eq(adminSessions.adminAccountId, adminAccount.id))
      .returning({ id: adminSessions.id });
    revokedSessions = deleted.length;
  }

  // 📧 發撤銷通知
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.email && !user.email.endsWith("@firebase.local")) {
    const field = await db.query.fields.findFirst({ where: eq(fields.id, fieldId) });
    const revoker = await db.query.users.findFirst({ where: eq(users.id, revokedBy) });
    sendAdminRevokedEmail({
      to: user.email,
      recipientName: formatUserName(user),
      fieldName: field?.name ?? "場域",
      revokedByName: formatUserName(revoker ?? null),
    }).catch((err) => console.error("[email] sendAdminRevokedEmail 失敗:", err));
  }

  return { success: true, revokedSessions };
}

/**
 * 暫停玩家（不撤銷管理身份，只凍結玩家端存取）
 * @param reason 變更理由（存 notes + 寄給玩家）
 */
export async function suspendPlayer(
  userId: string,
  fieldId: string,
  status: "suspended" | "banned" | "active",
  reason?: string
) {
  const membership = await getMembership(userId, fieldId);
  if (!membership) return { success: false, error: "該玩家並非此場域成員" };

  await db
    .update(fieldMemberships)
    .set({
      playerStatus: status,
      notes: reason ?? membership.notes,
      updatedAt: new Date(),
    })
    .where(eq(fieldMemberships.id, membership.id));

  // 📧 發狀態變更通知
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.email && !user.email.endsWith("@firebase.local")) {
    const field = await db.query.fields.findFirst({ where: eq(fields.id, fieldId) });
    sendPlayerSuspendedEmail({
      to: user.email,
      recipientName: formatUserName(user),
      fieldName: field?.name ?? "場域",
      status,
      reason,
    }).catch((err) => console.error("[email] sendPlayerSuspendedEmail 失敗:", err));
  }

  return { success: true };
}
