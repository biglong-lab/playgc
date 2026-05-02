// 🛠 LINE Admin Actions — 透過 LINE 直接管理 host sessions（W16 D3）
//
// 用途：admin 用 LINE 訊息查看 / 結束 active host sessions（不必開電腦）
//
// 端點對應：
//   listActiveSessionsForLineAdmin → 對應 GET /api/admin/host-sessions
//   endSessionForLineAdmin         → 對應 POST /api/admin/host-sessions/:id/end
//
// 認證：透過 isLineUserAdmin + getAdminFieldId（W15 D5 環境變數版）

import { db } from "../db";
import { games, gameSessions } from "@shared/schema";
import { and, eq, gte } from "drizzle-orm";
import { dispatchWebhook } from "./webhook-dispatcher";
import { isLineUserAdmin, getAdminFieldId } from "./admin-line-auth";

export interface ActiveSessionSummary {
  sessionId: string;
  gameId: string;
  gameTitle: string;
  startedAt: Date | null;
  expiresAt: Date | null;
  hostUrl: string;
  playUrl: string;
}

export interface ListActiveResult {
  ok: true;
  sessions: ActiveSessionSummary[];
}

export interface ActionError {
  ok: false;
  error: string;
  code: "not_admin" | "not_found" | "db_error" | "no_field";
}

/**
 * 列出 LINE admin 場域內的 active host sessions
 *
 * 規則：
 *   - 必須是 admin（isLineUserAdmin）
 *   - 篩選：hostMode=true + status='playing' + token 未過期
 *   - 場域過濾：admin 有 fieldId 才篩、無則回所有（簡化版）
 *
 * @example
 *   const result = await listActiveSessionsForLineAdmin("Uabc123...");
 *   if (result.ok) {
 *     console.log("active:", result.sessions.length);
 *   }
 */
export async function listActiveSessionsForLineAdmin(
  lineUserId: string | undefined,
): Promise<ListActiveResult | ActionError> {
  if (!isLineUserAdmin(lineUserId)) {
    return { ok: false, error: "您非 admin", code: "not_admin" };
  }

  try {
    const fieldId = getAdminFieldId(lineUserId);
    const now = new Date();
    const rows = await db
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

    // 場域過濾（admin 有 fieldId 才過濾）
    const filtered = fieldId
      ? rows.filter((r) => r.game.fieldId === fieldId)
      : rows;

    return {
      ok: true,
      sessions: filtered.map((r) => ({
        sessionId: r.session.id,
        gameId: r.game.id,
        gameTitle: r.game.title,
        startedAt: r.session.startedAt,
        expiresAt: r.session.hostTokenExpiresAt,
        hostUrl: `/host/${r.session.id}?token=${r.session.hostToken}`,
        playUrl: `/play/${r.session.id}`,
      })),
    };
  } catch (err) {
    console.error("[admin-line-actions] list 失敗:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "DB 失敗",
      code: "db_error",
    };
  }
}

/**
 * LINE admin 結束指定 host session
 *
 * 規則：
 *   - 必須是 admin
 *   - session 必須存在 + hostMode=true
 *   - 場域過濾：admin 有 fieldId 才檢查
 *   - 結束後派 instance.expired webhook（與 host-sessions /end 端點一致）
 */
export async function endSessionForLineAdmin(input: {
  lineUserId: string | undefined;
  sessionId: string;
}): Promise<{ ok: true; sessionId: string } | ActionError> {
  const { lineUserId, sessionId } = input;

  if (!isLineUserAdmin(lineUserId)) {
    return { ok: false, error: "您非 admin", code: "not_admin" };
  }

  try {
    const fieldId = getAdminFieldId(lineUserId);

    const [row] = await db
      .select({ session: gameSessions, game: games })
      .from(gameSessions)
      .innerJoin(games, eq(games.id, gameSessions.gameId))
      .where(
        and(
          eq(gameSessions.id, sessionId),
          eq(gameSessions.hostMode, true),
        ),
      );

    if (!row) {
      return { ok: false, error: "session 不存在或非 host 模式", code: "not_found" };
    }

    // 場域過濾（admin 有 fieldId 才檢查）
    if (fieldId && row.game.fieldId !== fieldId) {
      return {
        ok: false,
        error: "此 session 不在您的場域、無權結束",
        code: "no_field",
      };
    }

    await db
      .update(gameSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
        hostToken: null,
        hostTokenExpiresAt: null,
      })
      .where(eq(gameSessions.id, sessionId));

    // W15 D4 已有的 webhook 派發邏輯（複用、與 admin endpoint 一致）
    const defaultApiKeyId = process.env.API_KEY_DEFAULT_FOR_WEBHOOKS;
    if (defaultApiKeyId) {
      dispatchWebhook({
        type: "instance.expired",
        data: {
          sessionId,
          gameId: row.game.id,
          endedAt: new Date().toISOString(),
          endedBy: `line/${lineUserId?.slice(0, 8)}`,
        },
        apiKeyId: defaultApiKeyId,
      });
    }

    return { ok: true, sessionId };
  } catch (err) {
    console.error("[admin-line-actions] end 失敗:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "DB 失敗",
      code: "db_error",
    };
  }
}
