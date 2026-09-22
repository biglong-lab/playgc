// 🎟️ 訪客紀錄認領（2026-09-22 玩家動線優化 Phase 3）
//
// 業主需求：「遊戲結束，有需要紀錄，再引導使用者註冊，建立身份或者登入既有的身份」
//
// 問題：訪客（Firebase 匿名 uid）改用 Google / LINE / Email 登入會換成新的 uid，
//       訪客期間的遊戲紀錄就成了孤兒資料。
// 做法（三種登入方式同一條路、含「帳號早就註冊過」與跳頁登入）：
//   1. 還是訪客時：後端簽發 30 分鐘有效的 HMAC 認領憑證（證明「我是這個訪客」）
//   2. 前端改用正式帳號登入（可跳頁，憑證存 sessionStorage）
//   3. 以正式帳號帶憑證呼叫認領 → 本服務把訪客名下的紀錄搬到正式帳號
//
// 設計重點：
//   - 零 schema 變動：憑證是無狀態簽章（金鑰由 SESSION_SECRET 衍生），不建表
//   - 冪等：重複認領只會搬 0 筆（紀錄已經不在訪客名下）
//   - 不刪資料：唯一鍵衝突時保留正式帳號那筆、訪客那筆原地不動
//   - 識別字（表名 / 欄位名）來自下方固定白名單，值一律參數化
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";

/** 憑證有效期 */
export const CLAIM_TICKET_TTL_MS = 30 * 60 * 1000;

interface ClaimTicketPayload {
  v: 1;
  /** 訪客（匿名）uid */
  uid: string;
  /** 到期時間（ms） */
  exp: number;
  /** 隨機值：同一訪客每張憑證都不同 */
  n: string;
}

function getClaimKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET 未設定，無法簽發認領憑證");
  // 衍生專用子金鑰：與 admin JWT 用途隔離
  return createHmac("sha256", secret).update("chito-guest-claim-v1").digest();
}

function sign(body: string): string {
  return createHmac("sha256", getClaimKey()).update(body).digest("base64url");
}

/** 簽發認領憑證（呼叫端需確認 anonUid 真的是匿名帳號） */
export function createClaimTicket(anonUid: string, now = Date.now()): string {
  const payload: ClaimTicketPayload = {
    v: 1,
    uid: anonUid,
    exp: now + CLAIM_TICKET_TTL_MS,
    n: randomBytes(8).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** 驗證憑證 → 回傳訪客 uid；無效 / 過期回 null（不拋錯，避免洩漏細節） */
export function verifyClaimTicket(ticket: string, now = Date.now()): string | null {
  if (typeof ticket !== "string" || ticket.length > 1024) return null;
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<ClaimTicketPayload>;
    if (payload.v !== 1 || typeof payload.uid !== "string" || !payload.uid) return null;
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

interface ClaimTarget {
  table: string;
  column: string;
  /** 與這些欄位組合後，正式帳號已有同一筆 → 不搬（保留正式帳號那筆） */
  uniqueWith?: string[];
}

/**
 * 認領範圍：玩家看得到的「紀錄」
 * 刻意不搬：聊天、答題 / 投票 / 射擊等遊戲中暫存紀錄、水彈對戰（獨立系統）、稽核 / 遙測日誌
 */
export const CLAIM_TARGETS: readonly ClaimTarget[] = [
  { table: "player_progress", column: "user_id" },                                  // 遊戲場次紀錄、我的相簿
  { table: "player_chapter_progress", column: "user_id", uniqueWith: ["chapter_id"] }, // 章節進度
  { table: "player_achievements", column: "user_id", uniqueWith: ["achievement_id"] }, // 成就
  { table: "location_visits", column: "player_id" },                                // 地點打卡
  { table: "player_locations", column: "player_id" },                               // GPS 足跡
  { table: "team_members", column: "user_id", uniqueWith: ["team_id"] },            // 組隊紀錄
  { table: "teams", column: "leader_id" },
  { table: "squad_members", column: "user_id", uniqueWith: ["squad_id"] },          // 永久隊伍
  { table: "squads", column: "leader_id" },
  { table: "match_participants", column: "user_id", uniqueWith: ["match_id"] },     // 競賽
  { table: "field_memberships", column: "user_id", uniqueWith: ["field_id"] },      // 場域會員
  { table: "platform_coupons", column: "issued_to_user_id" },                       // 我的獎勵
  { table: "squad_external_rewards", column: "user_id" },
  { table: "purchases", column: "user_id" },                                        // 購買 / 兌換的遊戲權限
  { table: "redeem_code_uses", column: "user_id", uniqueWith: ["code_id"] },
  { table: "payment_transactions", column: "user_id" },
];

/** 識別字白名單檢查（防禦性：CLAIM_TARGETS 是常數，仍確保不會組出非預期 SQL） */
const IDENT = /^[a-z_]+$/;

function buildMoveStatement(target: ClaimTarget, anonUid: string, realUid: string) {
  const idents = [target.table, target.column, ...(target.uniqueWith ?? [])];
  if (!idents.every((i) => IDENT.test(i))) throw new Error(`非法識別字：${idents.join(",")}`);

  const t = sql.raw(target.table);
  const col = sql.raw(target.column);
  if (!target.uniqueWith?.length) {
    return sql`UPDATE ${t} SET ${col} = ${realUid} WHERE ${col} = ${anonUid}`;
  }
  const sameKey = sql.join(
    target.uniqueWith.map((c) => sql`o.${sql.raw(c)} = t.${sql.raw(c)}`),
    sql` AND `,
  );
  return sql`UPDATE ${t} AS t SET ${col} = ${realUid}
    WHERE t.${col} = ${anonUid}
      AND NOT EXISTS (SELECT 1 FROM ${t} AS o WHERE o.${col} = ${realUid} AND ${sameKey})`;
}

export type ClaimSummary = Record<string, number>;

/** 把訪客名下紀錄搬到正式帳號（單一 transaction，任一步失敗全部回滾） */
export async function claimGuestRecords(anonUid: string, realUid: string): Promise<ClaimSummary> {
  if (!anonUid || !realUid || anonUid === realUid) return {};
  return db.transaction(async (tx) => {
    const summary: ClaimSummary = {};
    for (const target of CLAIM_TARGETS) {
      const result = await tx.execute(buildMoveStatement(target, anonUid, realUid));
      const moved = Number((result as { rowCount?: number | null }).rowCount ?? 0);
      if (moved > 0) summary[target.table] = moved;
    }
    return summary;
  });
}
