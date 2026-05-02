// 🆕 ADR-0004 (2026-05-02)：HostScreen 主控大螢幕模式 — admin 端 session 管理
//
// 端點：
//   POST   /api/admin/host-sessions          建立 host session（簽發 hostToken）
//   GET    /api/admin/host-sessions          列出我場域的 active host sessions
//   POST   /api/admin/host-sessions/:id/end  結束 host session（吊銷 hostToken）
//   GET    /api/host-sessions/:id            玩家端取 session 基本資料（無需 hostToken）
//
// hostToken：
//   - 12 小時有效期
//   - 一次性簽發（重新建立 session 才換新 token）
//   - 大螢幕網址：/host/:sessionId?token={hostToken}

import type { Express } from "express";
import { db } from "../db";
import { gameSessions, games } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { isAuthenticated } from "../firebaseAuth";
import { randomBytes } from "crypto";
import { dispatchWebhook } from "../lib/webhook-dispatcher";

/** 簽發 12 小時 hostToken（32 字元 hex） */
function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

export function registerHostSessionRoutes(app: Express) {
  /**
   * POST /api/admin/host-sessions
   * Body: { gameId: string }
   * 建立新的 host session（不重用既有 session）
   */
  app.post(
    "/api/admin/host-sessions",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const { gameId } = req.body;
        if (!gameId) return res.status(400).json({ error: "缺少 gameId" });

        // 驗 game 存在 + 屬於該 admin 場域
        const [game] = await db.select().from(games).where(eq(games.id, gameId));
        if (!game) return res.status(404).json({ error: "遊戲不存在" });
        if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
          return res.status(403).json({ error: "無權限" });
        }

        // 簽發 hostToken
        const hostToken = generateHostToken();
        const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);

        const [session] = await db
          .insert(gameSessions)
          .values({
            gameId,
            status: "playing",
            hostMode: true,
            hostToken,
            hostTokenExpiresAt: expiresAt,
          })
          .returning();

        res.status(201).json({
          sessionId: session.id,
          hostToken,
          expiresAt: expiresAt.toISOString(),
          // 完整網址（admin 直接複製給活動主辦方用）
          hostUrl: `/host/${session.id}?token=${hostToken}`,
          playUrl: `/play/${session.id}`,
        });
      } catch (err) {
        console.error("[host-sessions] POST 失敗:", err);
        res.status(500).json({ error: "建立 host session 失敗" });
      }
    },
  );

  /**
   * GET /api/admin/host-sessions
   * 列出我場域的 active host sessions（status='playing' + host_mode=true + token 未過期）
   */
  app.get(
    "/api/admin/host-sessions",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const now = new Date();
        const activeRows = await db
          .select({
            session: gameSessions,
            game: games,
          })
          .from(gameSessions)
          .innerJoin(games, eq(games.id, gameSessions.gameId))
          .where(
            and(
              eq(gameSessions.hostMode, true),
              eq(gameSessions.status, "playing"),
              gte(gameSessions.hostTokenExpiresAt, now),
            ),
          );

        // 場域過濾（非 super_admin）
        const filtered = req.admin.systemRole === "super_admin"
          ? activeRows
          : activeRows.filter((r) => r.game.fieldId === req.admin!.fieldId);

        res.json({
          sessions: filtered.map((r) => ({
            sessionId: r.session.id,
            gameId: r.game.id,
            gameTitle: r.game.title,
            startedAt: r.session.startedAt,
            expiresAt: r.session.hostTokenExpiresAt,
            hostUrl: `/host/${r.session.id}?token=${r.session.hostToken}`,
            playUrl: `/play/${r.session.id}`,
          })),
        });
      } catch (err) {
        console.error("[host-sessions] GET 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );

  /**
   * POST /api/admin/host-sessions/:id/end
   * 結束 host session（標 completed + 吊銷 token）
   */
  app.post(
    "/api/admin/host-sessions/:id/end",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const [session] = await db
          .select()
          .from(gameSessions)
          .where(
            and(
              eq(gameSessions.id, req.params.id),
              eq(gameSessions.hostMode, true),
            ),
          );
        if (!session) return res.status(404).json({ error: "host session 不存在" });

        await db
          .update(gameSessions)
          .set({
            status: "completed",
            completedAt: new Date(),
            hostToken: null,           // 吊銷
            hostTokenExpiresAt: null,
          })
          .where(eq(gameSessions.id, req.params.id));

        // W15 D4: 結束時派發 webhook（fire-and-forget）
        // 取對應 game.description 中的 [scenario:<id>] + [via:api/v1] 標記
        // 若是代理商（via:api/v1）建立的 → 用其 API key 派 webhook
        if (session.gameId) {
          const [game] = await db.select().from(games).where(eq(games.id, session.gameId));
          if (game?.description?.includes("[via:api/v1]")) {
            // 從 description 抽 scenarioId
            const scenarioMatch = game.description.match(/\[scenario:([^\]]+)\]/);
            // W15 D4 暫無 game→apiKey 對應、用 default API key 派發（W15 D5 補完整 mapping）
            console.log("[host-sessions] [W15 D4] api/v1 host session ended:", {
              gameId: session.gameId,
              scenarioId: scenarioMatch?.[1],
              note: "W15 D5 補 game→apiKey mapping 後自動派 webhook",
            });
          }

          // 直接派 instance.expired 給場域的 default API key（如有）
          const defaultApiKeyId = process.env.API_KEY_DEFAULT_FOR_WEBHOOKS;
          if (defaultApiKeyId) {
            dispatchWebhook({
              type: "instance.expired",
              data: {
                sessionId: session.id,
                gameId: session.gameId,
                endedAt: new Date().toISOString(),
                endedBy: req.admin.username || "admin",
              },
              apiKeyId: defaultApiKeyId,
            });
          }
        }

        res.json({ success: true });
      } catch (err) {
        console.error("[host-sessions] end 失敗:", err);
        res.status(500).json({ error: "結束失敗" });
      }
    },
  );

  /**
   * GET /api/host-sessions/:id
   * 玩家端 / 大螢幕端取 session 基本資料（無需 hostToken，但會驗 host_mode）
   * 供 /host/:sessionId 與 /play/:sessionId 頁載入時用
   */
  app.get(
    "/api/host-sessions/:id",
    async (req, res) => {
      try {
        const [row] = await db
          .select({ session: gameSessions, game: games })
          .from(gameSessions)
          .innerJoin(games, eq(games.id, gameSessions.gameId))
          .where(eq(gameSessions.id, req.params.id));

        if (!row || !row.session.hostMode) {
          return res.status(404).json({ error: "session 不存在或非 HostScreen 模式" });
        }

        if (row.session.status !== "playing") {
          return res.status(410).json({ error: "session 已結束" });
        }

        // 不回傳 hostToken（敏感資料），只回基本資訊
        res.json({
          sessionId: row.session.id,
          gameId: row.game.id,
          gameTitle: row.game.title,
          startedAt: row.session.startedAt,
          expiresAt: row.session.hostTokenExpiresAt,
        });
      } catch (err) {
        console.error("[host-sessions] public GET 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );
}
