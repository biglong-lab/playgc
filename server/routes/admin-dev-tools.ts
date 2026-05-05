// 🧪 admin-dev-tools — 開發者工具：模擬玩家（多用戶測試）
//
// 三大能力（2026-05-05 重做 A+B+C）：
//   A. cascade 刪除：刪測試玩家前自動清所有 FK 關聯（不再被外鍵擋）
//   B. per-admin 隔離：每位 admin 各自有自己的測試玩家、互不干擾
//   C. 自動場域綁定：建立時自動 INSERT field_membership 進該 admin 場域
//
// email pattern：test{n}-{adminIdShort}@test.local
//   - {adminIdShort} = admin.id 前 8 碼（例 a1b2c3d4）
//   - 列表用 LIKE 'test%-{adminIdShort}@test.local' 只查自己建的
//   - 仍兼容舊 test{n}@test.local（顯示為「共用 legacy」）

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdminAuth } from "../adminAuth";
import { getAuth } from "firebase-admin/auth";
import { storage } from "../storage";
import { db } from "../db";
import { users, fieldMemberships } from "@shared/schema";
import { like, eq, and, sql } from "drizzle-orm";

const TEST_EMAIL_DOMAIN = "@test.local";
const MAX_TEST_PLAYERS = 10;

/** admin.id 取前 8 碼當 email 後綴的 unique 識別 */
function adminShortId(adminId: string): string {
  return adminId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "default";
}

/** email pattern: test{n}-{adminShortId}@test.local */
function buildTestEmail(n: number, adminShort: string): string {
  return `test${n}-${adminShort}${TEST_EMAIL_DOMAIN}`;
}

/** SQL LIKE pattern 找該 admin 自己的玩家 */
function buildTestEmailLikePattern(adminShort: string): string {
  return `test%-${adminShort}${TEST_EMAIL_DOMAIN}`;
}

/**
 * 強制 cascade 刪除使用者
 *
 * 動態用 information_schema 找所有指向 users.id 的 FK：
 *   - delete_rule = CASCADE → 跳過（DB 自動處理）
 *   - 子表 column 可空（is_nullable=YES）→ UPDATE SET NULL（保留 row）
 *   - 子表 column NOT NULL → DELETE row（刪掉那筆）
 *
 * 限：只能用在 @test.local 玩家（route 端已先驗）
 */
async function forceCascadeDeleteUser(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    type FkRow = {
      child_table: string;
      child_column: string;
      delete_rule: string;
      is_nullable: string;
    };

    const result = await tx.execute<FkRow>(sql`
      SELECT
        tc.table_name AS child_table,
        kcu.column_name AS child_column,
        rc.delete_rule,
        col.is_nullable
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.constraint_schema
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
        AND rc.unique_constraint_schema = ccu.constraint_schema
      JOIN information_schema.columns col
        ON tc.table_schema = col.table_schema
        AND tc.table_name = col.table_name
        AND kcu.column_name = col.column_name
      WHERE ccu.table_name = 'users'
        AND ccu.table_schema = 'public'
        AND tc.table_schema = 'public'
    `);

    // node-postgres 把結果包在 .rows、Drizzle pg adapter 也用同格式
    const rows: FkRow[] = (result as unknown as { rows?: FkRow[] }).rows ?? [];

    // 防 SQL injection 二次保險：information_schema 拿到的 identifier 仍嚴格驗證
    // （正常 PG identifier 為 [a-zA-Z_][a-zA-Z0-9_]*；不符合就 throw）
    const validateIdent = (s: string): void => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
        throw new Error(`非法 identifier: ${s}`);
      }
    };

    for (const fk of rows) {
      if (fk.delete_rule === "CASCADE") continue;

      validateIdent(fk.child_table);
      validateIdent(fk.child_column);
      const tbl = sql.identifier(fk.child_table);
      const col = sql.identifier(fk.child_column);

      if (fk.is_nullable === "YES") {
        // 例：teams.leader_id / matches.creator_id / battle_results.mvp_user_id
        // → SET NULL 保留資料（隊伍 / 比賽紀錄不該被誤刪）
        await tx.execute(sql`UPDATE ${tbl} SET ${col} = NULL WHERE ${col} = ${userId}`);
      } else {
        // 例：battle_clan_members / squad_match_records.user_id 等子表記錄
        // → DELETE 該玩家的 row（測試玩家紀錄無保留價值）
        await tx.execute(sql`DELETE FROM ${tbl} WHERE ${col} = ${userId}`);
      }
    }

    // 最後刪 user 本身（cascade 表會在這步自動清）
    await tx.delete(users).where(eq(users.id, userId));
  });
}

export function registerAdminDevToolsRoutes(app: Express): void {
  /**
   * GET /api/admin/dev-tools/test-players
   * 列出當前 admin 自己建的測試玩家（B: per-admin 隔離）
   */
  app.get(
    "/api/admin/dev-tools/test-players",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const admin = req.admin!;
        const adminShort = adminShortId(admin.id);
        const likePattern = buildTestEmailLikePattern(adminShort);

        const all = await db
          .select()
          .from(users)
          .where(like(users.email, likePattern));

        const list = all.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id,
          createdAt: u.createdAt,
        }));

        res.json({
          players: list,
          adminShortId: adminShort,
          fieldId: admin.fieldId,
          fieldName: admin.fieldName,
        });
      } catch (err) {
        console.error("[dev-tools] list 失敗:", err);
        res.status(500).json({ message: "列表失敗" });
      }
    },
  );

  /**
   * POST /api/admin/dev-tools/test-players
   * 建立 N 個測試玩家（每位 admin 各自獨立的池子、最多 10）
   * C: 同時 INSERT 一筆 field_membership 把玩家綁進該 admin 的場域
   */
  app.post(
    "/api/admin/dev-tools/test-players",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          count: z.number().int().min(1).max(MAX_TEST_PLAYERS),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "count 必須 1-10" });
        }

        const { count } = parsed.data;
        const admin = req.admin!;
        const adminShort = adminShortId(admin.id);
        const fieldId = admin.fieldId;
        const auth = getAuth();
        const created: Array<{ id: string; email: string; displayName: string }> = [];

        for (let i = 1; i <= count; i++) {
          const email = buildTestEmail(i, adminShort);
          const displayName = `測試玩家${i}_${admin.fieldCode || adminShort.slice(0, 4)}`;

          let firebaseUser;
          try {
            firebaseUser = await auth.getUserByEmail(email);
          } catch {
            firebaseUser = await auth.createUser({
              email,
              emailVerified: true,
              password: `test-${Date.now()}-${i}`,
              displayName,
              disabled: false,
            });
          }

          const user = await storage.upsertUser({
            id: firebaseUser.uid,
            email,
            firstName: displayName,
            lastName: null,
            profileImageUrl: null,
          });

          // C: 自動綁定到該 admin 的場域（已存在則 ON CONFLICT 跳過）
          if (fieldId) {
            await db
              .insert(fieldMemberships)
              .values({
                userId: user.id,
                fieldId,
                playerStatus: "active",
                isAdmin: false,
              })
              .onConflictDoNothing({
                target: [fieldMemberships.userId, fieldMemberships.fieldId],
              });
          }

          created.push({
            id: user.id,
            email: user.email!,
            displayName,
          });
        }

        res.json({
          created,
          totalCreated: created.length,
          fieldId,
          fieldName: admin.fieldName,
        });
      } catch (err) {
        console.error("[dev-tools] create 失敗:", err);
        res.status(500).json({
          message: err instanceof Error ? err.message : "建立失敗",
        });
      }
    },
  );

  /**
   * POST /api/admin/dev-tools/impersonate-test-player/:userId
   * 產生 Firebase customToken（1 小時）給 admin 開新分頁登入
   * 安全：限 email 必須 @test.local 且屬於該 admin（pattern 匹配）
   */
  app.post(
    "/api/admin/dev-tools/impersonate-test-player/:userId",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const admin = req.admin!;
        const adminShort = adminShortId(admin.id);
        const { userId } = req.params;
        const user = await storage.getUser(userId);

        if (!user) return res.status(404).json({ message: "玩家不存在" });
        if (!user.email?.endsWith(TEST_EMAIL_DOMAIN)) {
          return res.status(403).json({ message: "僅可 impersonate 測試玩家（@test.local）" });
        }

        // B: 驗證玩家屬於該 admin（防互踩）
        // legacy 玩家（test1@test.local 沒 -adminShort）super_admin 仍可 impersonate
        const isOwnPlayer = user.email.includes(`-${adminShort}@`);
        const isLegacy = !user.email.includes("-");
        if (!isOwnPlayer && !(isLegacy && admin.systemRole === "super_admin")) {
          return res.status(403).json({ message: "此測試玩家不屬於你、無法 impersonate" });
        }

        const auth = getAuth();
        const customToken = await auth.createCustomToken(userId, {
          isTestPlayer: true,
        });
        res.json({ customToken, userId, email: user.email });
      } catch (err) {
        console.error("[dev-tools] impersonate 失敗:", err);
        res.status(500).json({ message: "產生 token 失敗" });
      }
    },
  );

  /**
   * DELETE /api/admin/dev-tools/test-players/:userId
   * 刪除測試玩家（A: cascade 清關聯 + B: 限自己的）
   */
  app.delete(
    "/api/admin/dev-tools/test-players/:userId",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const admin = req.admin!;
        const adminShort = adminShortId(admin.id);
        const { userId } = req.params;
        const user = await storage.getUser(userId);

        if (!user) return res.status(404).json({ message: "玩家不存在" });
        if (!user.email?.endsWith(TEST_EMAIL_DOMAIN)) {
          return res.status(403).json({ message: "僅可刪除測試玩家" });
        }

        const isOwnPlayer = user.email.includes(`-${adminShort}@`);
        const isLegacy = !user.email.includes("-");
        if (!isOwnPlayer && !(isLegacy && admin.systemRole === "super_admin")) {
          return res.status(403).json({ message: "此測試玩家不屬於你、無法刪除" });
        }

        // Firebase 先嘗試刪（失敗仍繼續、可能已被外部刪過）
        const auth = getAuth();
        try {
          await auth.deleteUser(userId);
        } catch {
          /* Firebase 已不存在、繼續清 DB */
        }

        // A: cascade 清 DB 關聯後刪 user
        await forceCascadeDeleteUser(userId);

        res.json({ success: true });
      } catch (err) {
        console.error("[dev-tools] delete 失敗:", err);
        res.status(500).json({
          message: err instanceof Error ? err.message : "刪除失敗",
        });
      }
    },
  );

  /**
   * DELETE /api/admin/dev-tools/test-players
   * 一鍵清空當前 admin 的所有測試玩家（A: cascade、B: 限自己的）
   */
  app.delete(
    "/api/admin/dev-tools/test-players",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const admin = req.admin!;
        const adminShort = adminShortId(admin.id);
        const likePattern = buildTestEmailLikePattern(adminShort);

        const own = await db
          .select({ id: users.id })
          .from(users)
          .where(like(users.email, likePattern));

        const auth = getAuth();
        let deletedCount = 0;
        const failed: string[] = [];

        for (const u of own) {
          try {
            try {
              await auth.deleteUser(u.id);
            } catch {
              /* Firebase 已不存在 */
            }
            await forceCascadeDeleteUser(u.id);
            deletedCount += 1;
          } catch (e) {
            failed.push(u.id);
            console.error(`[dev-tools] 全清失敗於 ${u.id}:`, e);
          }
        }

        res.json({
          deletedCount,
          totalRequested: own.length,
          failed,
        });
      } catch (err) {
        console.error("[dev-tools] bulk-delete 失敗:", err);
        res.status(500).json({
          message: err instanceof Error ? err.message : "一鍵全清失敗",
        });
      }
    },
  );
}
