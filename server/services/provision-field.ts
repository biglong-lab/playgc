// 🏗️ 開通場域（P2 底座，2026-09-23）
//
// 背景：原本有兩套建場流程 —— 後台「新增場域」會 seed 預設角色並把建立者設成場域管理員；
//   平台審核申請通過卻只建場域 + 訂閱，沒有角色、也沒有申請人帳號 → 申請人收到通知卻登不進去。
//
// 這支把開通收成一條路：
//   建場域 → 預設角色（場域管理員 / 活動執行者）→ 訂閱（含試用）→ 申請人帳號 → 發 field.provisioned 事件
//
// 帳號怎麼登入：admin_accounts 存 email + 角色即可；申請人第一次用 Firebase（Google / Email）登入時
//   server/routes/auth.ts 會用 email 比對並自動綁定 firebaseUserId。
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  adminAccounts,
  fields,
  fieldSubscriptions,
  permissions,
  platformPlans,
  rolePermissions,
  roles,
} from "@shared/schema";
import { emitEvent } from "../lib/event-bus";

/** 活動執行者的預設權限（現場營運夠用、碰不到設定與帳務） */
const EXECUTOR_PERMISSIONS = [
  "game:view",
  "session:manage",
  "qr:scan_check",
  "qr:view",
  "leaderboard:view",
  "user:view",
  "booking:view_today",
  "booking:mark_attended",
  "pos:view",
  "pos:operate",
];

export interface ProvisionFieldInput {
  code: string;
  name: string;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  /** 預設 free */
  planCode?: string;
  /** 試用天數（0 = 直接 active） */
  trialDays?: number;
  /** 開通後要能登入後台的人（通常是申請人）；沒有 email 就不建帳號 */
  owner?: { email?: string | null; displayName?: string | null };
  /** 稽核用 */
  actorAdminId?: string | null;
  source: "platform_approval" | "admin_create";
  /** 訂閱備註（例如「自動開通自申請 xxx」） */
  notes?: string | null;
  /** 申請來源的經銷代碼（P3 用） */
  partnerCode?: string | null;
}

export interface ProvisionFieldSuccess {
  ok: true;
  field: typeof fields.$inferSelect;
  directorRoleId: string | null;
  ownerAccountId: string | null;
  trialEndsAt: Date | null;
  planCode: string;
}

export type ProvisionFieldResult = ProvisionFieldSuccess | { ok: false; status: 400 | 409; message: string };

/** 預設角色：場域管理員（全權限）+ 活動執行者（現場營運）；回傳管理員角色 ID */
export async function seedDefaultRoles(fieldId: string): Promise<string | null> {
  const allPermissions = await db.select({ id: permissions.id, key: permissions.key }).from(permissions);
  if (allPermissions.length === 0) return null; // 連權限都還沒建 → 不要建空角色

  const [directorRole] = await db.insert(roles).values({
    name: "場域管理員",
    description: "場域最高管理權限，可管理所有功能（開通場域時自動建立）",
    systemRole: "field_director",
    fieldId,
    isCustom: false,
    isDefault: true,
  }).returning();
  await db.insert(rolePermissions).values(
    allPermissions.map((p) => ({ roleId: directorRole.id, permissionId: p.id, allow: true })),
  );

  const permByKey = new Map(allPermissions.map((p) => [p.key, p.id]));
  const executorPermIds = EXECUTOR_PERMISSIONS.map((k) => permByKey.get(k)).filter((id): id is string => !!id);
  if (executorPermIds.length > 0) {
    const [executorRole] = await db.insert(roles).values({
      name: "活動執行者",
      description: "現場活動執行權限（檢視遊戲、管理場次、QR 查驗、今日預約、POS 操作）",
      systemRole: "field_executor",
      fieldId,
      isCustom: false,
      isDefault: false,
    }).returning();
    await db.insert(rolePermissions).values(
      executorPermIds.map((permissionId) => ({ roleId: executorRole.id, permissionId, allow: true })),
    );
  }
  return directorRole.id;
}

/** 建立（或沿用）場域管理員帳號；沒 email 就不建 */
async function ensureOwnerAccount(
  fieldId: string, roleId: string | null, owner: ProvisionFieldInput["owner"],
): Promise<string | null> {
  const email = owner?.email?.trim().toLowerCase();
  if (!email || !roleId) return null;
  const existing = await db.query.adminAccounts.findFirst({
    where: and(eq(adminAccounts.fieldId, fieldId), eq(adminAccounts.email, email)),
  });
  if (existing) {
    await db.update(adminAccounts)
      .set({ roleId, status: "active", updatedAt: new Date() })
      .where(eq(adminAccounts.id, existing.id));
    return existing.id;
  }
  const [account] = await db.insert(adminAccounts).values({
    fieldId,
    username: email,
    email,
    displayName: owner?.displayName?.trim() || email.split("@")[0],
    roleId,
    status: "active",
  }).returning();
  return account.id;
}

/**
 * 開通一個場域（唯一入口）
 * 任何一步失敗都會往外丟，呼叫端回 500 —— 這裡不做部分回滾（見檔尾說明）
 */
export async function provisionField(input: ProvisionFieldInput): Promise<ProvisionFieldResult> {
  const code = input.code.trim().toUpperCase();
  const taken = await db.query.fields.findFirst({ where: eq(fields.code, code) });
  if (taken) return { ok: false, status: 409, message: "場域代碼已被使用" };

  const planCode = input.planCode ?? "free";
  const plan = await db.query.platformPlans.findFirst({ where: eq(platformPlans.code, planCode) });
  if (!plan) return { ok: false, status: 400, message: `找不到方案：${planCode}` };

  const [field] = await db.insert(fields).values({
    code,
    name: input.name.trim(),
    description: input.description ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    address: input.address ?? null,
    status: "active",
  }).returning();

  const directorRoleId = await seedDefaultRoles(field.id);

  const trialDays = input.trialDays ?? 0;
  const trialEndsAt = trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;
  await db.insert(fieldSubscriptions).values({
    fieldId: field.id,
    planId: plan.id,
    status: trialEndsAt ? "trial" : "active",
    billingCycle: "monthly",
    trialEndsAt,
    notes: input.notes ?? null,
  });

  const ownerAccountId = await ensureOwnerAccount(field.id, directorRoleId, input.owner);

  emitEvent("field.provisioned", {
    fieldId: field.id,
    fieldCode: field.code,
    fieldName: field.name,
    planCode,
    source: input.source,
    partnerCode: input.partnerCode ?? null,
    ownerAccountId,
    ownerEmail: input.owner?.email ?? null,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    occurredAt: new Date().toISOString(),
  });

  return { ok: true, field, directorRoleId, ownerAccountId, trialEndsAt, planCode };
}

// 為什麼不用交易包住：fields / roles / role_permissions / field_subscriptions / admin_accounts 跨 5 張表，
// 中間任一步失敗時「已建好的場域」留著比整批消失好查（平台管理員看得到、可手動補或改代碼重開），
// 而且這條路一天跑不到幾次。若之後要改成交易，記得事件要等交易 commit 後才發。
