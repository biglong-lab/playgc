// 開機 idempotent 補 POS 現金權限（2026-06-22）
//
// 權限是 DB rows（permissions 表），新權限 key 不會自動出現在生產。
// 此模組在 startup 用 ON CONFLICT DO NOTHING 補入，純新增、可重複執行、零風險。
// super_admin 自動擁有全部權限；其餘帳號由權限矩陣指派。

import { db } from "../db";
import { sql } from "drizzle-orm";

const POS_PERMISSIONS = [
  { key: "pos_cash_admin", name: "POS 現金管理（清帳/報表/差異確認）", category: "pos" },
];

export async function ensurePosPermissions(): Promise<void> {
  try {
    for (const p of POS_PERMISSIONS) {
      await db.execute(sql`
        INSERT INTO permissions (key, name, category)
        VALUES (${p.key}, ${p.name}, ${p.category})
        ON CONFLICT (key) DO NOTHING
      `);
    }
  } catch (err) {
    console.error("[ensure-pos-permissions] 失敗:", err);
  }
}
