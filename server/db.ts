import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 資料庫連線池配置
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // 最大連線數
  idleTimeoutMillis: 30000,     // 閒置連線超時（30 秒）
  connectionTimeoutMillis: 5000, // 連線超時（5 秒）
});

// 連線池錯誤處理 - 避免未處理的錯誤導致程式崩潰
pool.on('error', () => {
  // 生產環境可整合告警機制（Sentry、Slack 等）
});

export const db = drizzle(pool, { schema });

// 優雅關閉函數
export async function closePool(): Promise<void> {
  await pool.end();
}
