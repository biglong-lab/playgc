// 📊 營收分析 API — 趨勢 / 維度 / 明細（2026-08-01）
//
// 端點（全部 requireAdminAuth + game:view + fieldId 場域隔離）：
//   GET /api/revenue/analytics/summary       KPI + 環比
//   GET /api/revenue/analytics/timeseries    趨勢圖資料
//   GET /api/revenue/analytics/breakdown     維度排行
//   GET /api/revenue/analytics/transactions  跨源明細
//
// 金額一律以「分」回傳，欄位皆以 Cents 結尾。前端顯示時才除 100。

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { getRevenueSummary, taipeiToday, type RevenueSource } from "../lib/revenue-facts";
import {
  getRevenueTimeseries,
  getRevenueBreakdown,
  getRevenueTransactions,
  type Granularity,
  type BreakdownDimension,
} from "../lib/revenue-aggregations";

/** 單次查詢的最長區間，防止大範圍掃表拖垮 DB */
const MAX_RANGE_DAYS = 400;
const DEFAULT_RANGE_DAYS = 30;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式須為 YYYY-MM-DD");

const rangeSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

const granularitySchema = z.enum(["day", "week", "month"]).default("day");

const dimensionSchema = z.enum([
  "source", "pos_product", "pos_category", "pos_modifier", "activity", "method", "catalog",
]);

const sourceSchema = z.enum(["pos", "game", "battle"]);

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

interface ResolvedRange {
  from: string;
  to: string;
  days: number;
}

/** 解析並夾限區間；未指定 → 近 30 天 */
function resolveRange(query: unknown): ResolvedRange | { error: string } {
  const parsed = rangeSchema.safeParse(query);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "區間參數錯誤" };
  }
  const to = parsed.data.to ?? taipeiToday();
  const from = parsed.data.from ?? shiftDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) return { error: "起始日不可晚於結束日" };
  const days = daysBetween(from, to);
  if (days > MAX_RANGE_DAYS) {
    return { error: `查詢區間最長 ${MAX_RANGE_DAYS} 天（目前 ${days} 天）` };
  }
  return { from, to, days };
}

function fail(res: Response, err: unknown, label: string): void {
  console.error(`[revenue-analytics/${label}]`, err);
  res.status(500).json({ message: "取得營收分析資料失敗" });
}

/** 共用前置：驗證登入 + 解析區間 */
function prepare(req: Request, res: Response): { fieldId: string; range: ResolvedRange } | null {
  if (!req.admin) {
    res.status(401).json({ message: "未認證" });
    return null;
  }
  const range = resolveRange(req.query);
  if ("error" in range) {
    res.status(400).json({ message: range.error });
    return null;
  }
  return { fieldId: req.admin.fieldId, range };
}

/** 成長率（%），前期為 0 時回 null 避免出現無意義的 Infinity */
function growthRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function registerRevenueAnalyticsRoutes(app: Express): void {
  // ──────────────────────────────────────────────────────────
  // KPI + 環比
  // ──────────────────────────────────────────────────────────
  app.get(
    "/api/revenue/analytics/summary",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const ctx = prepare(req, res);
        if (!ctx) return;
        const { fieldId, range } = ctx;

        const wantCompare = req.query.compare === "prev";
        const prevTo = shiftDays(range.from, -1);
        const prevFrom = shiftDays(prevTo, -(range.days - 1));

        const [current, previous] = await Promise.all([
          getRevenueSummary(fieldId, { from: range.from, to: range.to }),
          wantCompare
            ? getRevenueSummary(fieldId, { from: prevFrom, to: prevTo })
            : Promise.resolve(null),
        ]);

        const avgTicketCents =
          current.txCount > 0 ? Math.round(current.netCents / current.txCount) : 0;
        const refundRate =
          current.grossCents > 0
            ? Math.round((current.refundCents / current.grossCents) * 1000) / 10
            : 0;

        res.json({
          range: { from: range.from, to: range.to, days: range.days },
          ...current,
          avgTicketCents,
          refundRate,
          previous: previous
            ? {
                range: { from: prevFrom, to: prevTo },
                netCents: previous.netCents,
                grossCents: previous.grossCents,
                txCount: previous.txCount,
                growth: {
                  netCents: growthRate(current.netCents, previous.netCents),
                  txCount: growthRate(current.txCount, previous.txCount),
                },
              }
            : null,
        });
      } catch (err) {
        fail(res, err, "summary");
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 趨勢
  // ──────────────────────────────────────────────────────────
  app.get(
    "/api/revenue/analytics/timeseries",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const ctx = prepare(req, res);
        if (!ctx) return;

        const g = granularitySchema.safeParse(req.query.granularity ?? "day");
        if (!g.success) {
          return res.status(400).json({ message: "granularity 只能是 day / week / month" });
        }

        const buckets = await getRevenueTimeseries(
          ctx.fieldId,
          { from: ctx.range.from, to: ctx.range.to },
          g.data as Granularity,
        );

        // 累計線（前端畫雙軸用，避免在前端再跑一次迴圈）
        let running = 0;
        const series = buckets.map((b) => {
          running += b.netCents;
          return { ...b, cumulativeCents: running };
        });

        res.json({
          range: { from: ctx.range.from, to: ctx.range.to },
          granularity: g.data,
          series,
        });
      } catch (err) {
        fail(res, err, "timeseries");
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 維度排行
  // ──────────────────────────────────────────────────────────
  app.get(
    "/api/revenue/analytics/breakdown",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const ctx = prepare(req, res);
        if (!ctx) return;

        const dim = dimensionSchema.safeParse(req.query.dimension);
        if (!dim.success) {
          return res.status(400).json({
            message: `dimension 必須是：${dimensionSchema.options.join(" / ")}`,
          });
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

        const result = await getRevenueBreakdown(
          ctx.fieldId,
          { from: ctx.range.from, to: ctx.range.to },
          dim.data as BreakdownDimension,
          limit,
        );

        res.json({ range: { from: ctx.range.from, to: ctx.range.to }, ...result });
      } catch (err) {
        fail(res, err, "breakdown");
      }
    },
  );

  // ──────────────────────────────────────────────────────────
  // 明細下鑽
  // ──────────────────────────────────────────────────────────
  app.get(
    "/api/revenue/analytics/transactions",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const ctx = prepare(req, res);
        if (!ctx) return;

        const raw = typeof req.query.sources === "string" ? req.query.sources.split(",") : [];
        const sources: RevenueSource[] = [];
        for (const s of raw) {
          const parsed = sourceSchema.safeParse(s.trim());
          if (!parsed.success) {
            return res.status(400).json({ message: `不支援的來源：${s}` });
          }
          sources.push(parsed.data);
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);

        const transactions = await getRevenueTransactions(
          ctx.fieldId,
          { from: ctx.range.from, to: ctx.range.to },
          { sources, limit },
        );

        res.json({
          range: { from: ctx.range.from, to: ctx.range.to },
          transactions,
          total: transactions.length,
          truncated: transactions.length === limit,
        });
      } catch (err) {
        fail(res, err, "transactions");
      }
    },
  );
}
