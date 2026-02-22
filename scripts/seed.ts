// 種子資料初始化腳本 - 建立場域、角色、權限、管理員帳號和展示遊戲
// 使用方式: npx tsx scripts/seed.ts
import { db } from "../server/db";
import {
  fields,
  roles,
  permissions,
  rolePermissions,
  adminAccounts,
  games,
  pages,
} from "@shared/schema";
import { GAME_MODULES } from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

// ============================================================================
// 所有系統權限定義
// ============================================================================
const ALL_PERMISSIONS = [
  // 遊戲管理
  { key: "game:view", name: "檢視遊戲", category: "game" },
  { key: "game:create", name: "建立遊戲", category: "game" },
  { key: "game:edit", name: "編輯遊戲", category: "game" },
  { key: "game:delete", name: "刪除遊戲", category: "game" },
  { key: "game:publish", name: "發布遊戲", category: "game" },
  // 頁面/道具
  { key: "page:view", name: "檢視頁面", category: "content" },
  { key: "page:edit", name: "編輯頁面", category: "content" },
  { key: "item:view", name: "檢視道具", category: "content" },
  { key: "item:edit", name: "編輯道具", category: "content" },
  // QR Code
  { key: "qr:generate", name: "產生 QR Code", category: "qr" },
  { key: "qr:view", name: "檢視 QR Code", category: "qr" },
  // 場域管理
  { key: "field:manage", name: "管理場域", category: "field" },
  // 使用者管理
  { key: "user:view", name: "檢視使用者", category: "user" },
  { key: "user:manage_roles", name: "管理角色", category: "user" },
  // 管理員帳號
  { key: "admin:manage_accounts", name: "管理帳號", category: "admin" },
  { key: "admin:view_audit", name: "檢視審計日誌", category: "admin" },
];

async function seed() {
  console.log("🌱 開始初始化種子資料...\n");

  // 1. 建立場域
  console.log("📍 建立場域...");
  const fieldId = randomUUID();
  await db.insert(fields).values({
    id: fieldId,
    name: "賈村競技場",
    code: "JIACHUN",
    description: "賈村競技場是一個結合實境遊戲與數位互動的戶外遊戲平台",
    address: "台灣",
    contactEmail: "admin@jiachun.com",
    status: "active",
  });
  console.log("  ✅ 場域「賈村競技場」(JIACHUN) 已建立");

  // 2. 建立權限
  console.log("\n🔑 建立系統權限...");
  const permissionIds: Record<string, string> = {};
  for (const perm of ALL_PERMISSIONS) {
    const id = randomUUID();
    permissionIds[perm.key] = id;
    await db.insert(permissions).values({
      id,
      key: perm.key,
      name: perm.name,
      description: perm.name,
      category: perm.category,
    });
  }
  console.log(`  ✅ ${ALL_PERMISSIONS.length} 個權限已建立`);

  // 3. 建立角色
  console.log("\n👑 建立角色...");
  const superAdminRoleId = randomUUID();
  await db.insert(roles).values({
    id: superAdminRoleId,
    fieldId: null, // 系統級角色
    name: "超級管理員",
    systemRole: "super_admin",
    description: "擁有所有權限的系統管理員",
    isCustom: false,
    isDefault: false,
  });

  // 綁定所有權限給 super_admin
  for (const [key, permId] of Object.entries(permissionIds)) {
    await db.insert(rolePermissions).values({
      id: randomUUID(),
      roleId: superAdminRoleId,
      permissionId: permId,
      allow: true,
    });
  }
  console.log("  ✅ 超級管理員角色已建立（含所有權限）");

  // 場域管理員角色
  const fieldAdminRoleId = randomUUID();
  await db.insert(roles).values({
    id: fieldAdminRoleId,
    fieldId,
    name: "場域管理員",
    systemRole: "field_manager",
    description: "管理該場域的遊戲和設定",
    isCustom: false,
    isDefault: true,
  });

  // 場域管理員權限（不含 field:manage、admin:manage_accounts）
  const fieldAdminPerms = ALL_PERMISSIONS.filter(
    (p) => !["field:manage", "admin:manage_accounts"].includes(p.key)
  );
  for (const perm of fieldAdminPerms) {
    await db.insert(rolePermissions).values({
      id: randomUUID(),
      roleId: fieldAdminRoleId,
      permissionId: permissionIds[perm.key],
      allow: true,
    });
  }
  console.log("  ✅ 場域管理員角色已建立");

  // 場域主管角色（與場域管理員相同權限，可依需求微調）
  const fieldDirectorRoleId = randomUUID();
  await db.insert(roles).values({
    id: fieldDirectorRoleId,
    fieldId,
    name: "場域主管",
    systemRole: "field_director",
    description: "場域主管，負責監督場域營運",
    isCustom: false,
    isDefault: false,
  });

  for (const perm of fieldAdminPerms) {
    await db.insert(rolePermissions).values({
      id: randomUUID(),
      roleId: fieldDirectorRoleId,
      permissionId: permissionIds[perm.key],
      allow: true,
    });
  }
  console.log("  ✅ 場域主管角色已建立");

  // 場域執行者角色（唯讀權限）
  const fieldExecutorRoleId = randomUUID();
  await db.insert(roles).values({
    id: fieldExecutorRoleId,
    fieldId,
    name: "場域執行者",
    systemRole: "field_executor",
    description: "場域執行者，只能查看資料和執行遊戲",
    isCustom: false,
    isDefault: false,
  });

  const executorPerms = ["game:view", "page:view", "item:view", "qr:view", "user:view"];
  for (const permKey of executorPerms) {
    await db.insert(rolePermissions).values({
      id: randomUUID(),
      roleId: fieldExecutorRoleId,
      permissionId: permissionIds[permKey],
      allow: true,
    });
  }
  console.log("  ✅ 場域執行者角色已建立（唯讀）");

  // 4. 建立管理員帳號（帳密登入）
  console.log("\n👤 建立管理員帳號...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(adminAccounts).values({
    id: randomUUID(),
    fieldId,
    username: "admin",
    passwordHash,
    displayName: "系統管理員",
    email: "admin@jiachun.com",
    roleId: superAdminRoleId,
    status: "active",
  });
  console.log("  ✅ 帳號 admin / admin123 已建立（超級管理員）");

  // 5. 建立展示遊戲（從模組庫前 3 個模組建立，狀態為 published）
  console.log("\n🎮 建立展示遊戲...");
  const modulesToCreate = GAME_MODULES.slice(0, 3);

  for (const mod of modulesToCreate) {
    const gameId = randomUUID();
    const slug = `demo-${mod.id.replace(/_/g, "-")}`;

    await db.insert(games).values({
      id: gameId,
      title: `[展示] ${mod.name}`,
      description: mod.description,
      fieldId,
      difficulty: mod.difficulty,
      estimatedTime: mod.estimatedTime,
      maxPlayers: mod.maxPlayers,
      status: "published", // 直接發布
      publicSlug: slug,
      creatorId: null,
    });

    // 建立頁面
    for (let i = 0; i < mod.pages.length; i++) {
      const page = mod.pages[i];
      await db.insert(pages).values({
        id: randomUUID(),
        gameId,
        pageType: page.pageType,
        pageOrder: i + 1,
        config: page.config,
      });
    }

    console.log(`  ✅ 「${mod.name}」已建立 (${mod.pages.length} 頁, slug: ${slug})`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 種子資料初始化完成！");
  console.log("=".repeat(60));
  console.log("\n📋 登入資訊：");
  console.log("  場域編號: JIACHUN");
  console.log("  帳號: admin");
  console.log("  密碼: admin123");
  console.log("\n🌐 訪問 http://localhost:3333/admin/login 開始使用");
  console.log("   或 http://localhost:3333/home 查看已發布的遊戲\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ 種子資料初始化失敗:", err);
  process.exit(1);
});
