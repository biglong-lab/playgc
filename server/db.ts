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
// 目標：撐住 500 人同時玩 —— Postgres 預設 max_connections=100，
// 留 20 給 admin / migration / 外部工具，應用端使用 80。
// 生產負載計算：500 並發 × 平均每人每秒 3-5 queries × 50ms/query
// = 75-125 queries/秒 → 80 pool × 1000/50ms = 1600 queries/sec 容量綽綽有餘
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 80, // 最大連線數（可由 env 調）
  idleTimeoutMillis: 30000,     // 閒置連線超時（30 秒）
  connectionTimeoutMillis: 5000, // 連線超時（5 秒）
  // 新增：statement 超時（單一 query 最多 10 秒，防慢查詢占連線）
  statement_timeout: 10000,
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
