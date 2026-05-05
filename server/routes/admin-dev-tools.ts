// 🧪 admin-dev-tools — 開發者工具：模擬玩家（多用戶測試）
//
// 用途：使用者反饋「不可能用真的很多人來做測試、需要虛擬身份」
// 設計：
//   - 限 super_admin（從 requireAdminAuth）能呼叫
//   - 建立 user 用 reserved domain @test.local（不會跟真實 user 衝突）
//   - 用 Firebase Admin SDK 建立 user + 產生 customToken
//   - admin 開新 incognito 分頁、URL 帶 customToken → 自動以該 user 登入
//   - 測試完可批次刪除（只刪 @test.local 的）

import type { Express, Response } from "express";
import { z } from "zod";
import { requireAdminAuth } from "../adminAuth";
import { getAuth } from "firebase-admin/auth";
import { storage } from "../storage";
import { db } from "../db";
import { users } from "@shared/schema";
import { like, eq } from "drizzle-orm";

const TEST_EMAIL_DOMAIN = "@test.local";
const MAX_TEST_PLAYERS = 10;

export function registerAdminDevToolsRoutes(app: Express): void {
  /**
   * GET /api/admin/dev-tools/test-players
   * 列出當前已建的測試玩家
   */
  app.get(
    "/api/admin/dev-tools/test-players",
    requireAdminAuth,
    async (_req: unknown, res: Response) => {
      try {
        const all = await db
          .select()
          .from(users)
          .where(like(users.email, `%${TEST_EMAIL_DOMAIN}`));
        const list = all.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id,
          createdAt: u.createdAt,
        }));
        res.json({ players: list });
      } catch (err) {
        console.error("[dev-tools] list 失敗:", err);
        res.status(500).json({ message: "列表失敗" });
      }
    },
  );

  /**
   * POST /api/admin/dev-tools/test-players
   * 建立 N 個測試玩家（最多 10、補到 N 個為止；既有 test 玩家不會重建）
   */
  app.post(
    "/api/admin/dev-tools/test-players",
    requireAdminAuth,
    async (req, res: Response) => {
      try {
        const schema = z.object({
          count: z.number().int().min(1).max(MAX_TEST_PLAYERS),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "count 必須 1-10" });
        }
        const { count } = parsed.data;
        const auth = getAuth();
        const created: Array<{ id: string; email: string; displayName: string }> = [];

        for (let i = 1; i <= count; i++) {
          const email = `test${i}${TEST_EMAIL_DOMAIN}`;
          const displayName = `測試玩家 ${i}`;
          // 看 Firebase 是否已有
          let firebaseUser;
          try {
            firebaseUser = await auth.getUserByEmail(email);
          } catch {
            // 不存在 → 建
            firebaseUser = await auth.createUser({
              email,
              emailVerified: true,
              password: `test-${Date.now()}-${i}`, // 一次性、不會用到（走 customToken）
              displayName,
              disabled: false,
            });
          }

          // DB upsert
          const user = await storage.upsertUser({
            id: firebaseUser.uid,
            email,
            firstName: displayName,
            lastName: null,
            profileImageUrl: null,
          });

          created.push({
            id: user.id,
            email: user.email!,
            displayName,
          });
        }

        res.json({ created, totalCreated: created.length });
      } catch (err) {
        console.error("[dev-tools] create 失敗:", err);
        res.status(500).json({ message: err instanceof Error ? err.message : "建立失敗" });
      }
    },
  );

  /**
   * POST /api/admin/dev-tools/impersonate-test-player/:userId
   * 產生 Firebase customToken（短期、有效 1 小時）給 admin 開新分頁登入
   * 安全：限 email 必須 @test.local（避免 admin 借此切換真實玩家）
   */
  app.post(
    "/api/admin/dev-tools/impersonate-test-player/:userId",
    requireAdminAuth,
    async (req, res: Response) => {
      try {
        const { userId } = req.params;
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: "玩家不存在" });
        if (!user.email?.endsWith(TEST_EMAIL_DOMAIN)) {
          return res.status(403).json({
            message: "僅可 impersonate 測試玩家（@test.local）",
          });
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
   * 刪除測試玩家（同時清 Firebase + DB）
   */
  app.delete(
    "/api/admin/dev-tools/test-players/:userId",
    requireAdminAuth,
    async (req, res: Response) => {
      try {
        const { userId } = req.params;
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: "玩家不存在" });
        if (!user.email?.endsWith(TEST_EMAIL_DOMAIN)) {
          return res.status(403).json({
            message: "僅可刪除測試玩家",
          });
        }
        const auth = getAuth();
        try {
          await auth.deleteUser(userId);
        } catch {
          // Firebase 已刪除、繼續清 DB
        }
        await db.delete(users).where(eq(users.id, userId));
        res.json({ success: true });
      } catch (err) {
        console.error("[dev-tools] delete 失敗:", err);
        res.status(500).json({ message: "刪除失敗" });
      }
    },
  );
}
