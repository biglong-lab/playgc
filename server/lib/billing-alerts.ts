// 💰 計費警示計算（P0-3）
//
// 純計算函式：根據 fieldSubscriptions / platformTransactions 當前狀態
// 算出所有需要 admin 關注的計費風險。
//
// 4 種警示類型：
//   1. expiring_soon — 訂閱即將到期（7 / 14 / 30 天）
//   2. expired — 訂閱已過期但仍 active
//   3. failed_payment — 最近交易失敗
//   4. overdue — 待付款但已逾期
//
// 設計原則：
//   - 純讀取，不寫入（純算當下狀態）
//   - 一次性掃描，避免 N+1
//   - 回傳已 enrich 的 alert（含 field 資訊給前端直接用）

import { db } from "../db";
import {
  fieldSubscriptions,
  platformTransactions,
  fields,
} from "@shared/schema";
import { eq, sql, lt, gte, lte, and, inArray, ne, isNotNull } from "drizzle-orm";

export type BillingAlertSeverity = "info" | "warning" | "urgent" | "critical";

export interface BillingAlert {
  id: string; // 唯一識別（type + fieldId + relevantId）
  type:
    | "expiring_soon"
    | "expired"
    | "failed_payment"
    | "overdue";
  severity: BillingAlertSeverity;
  fieldId: string;
  field?: { id: string; name: string; code: string };
  title: string;
  message: string;
  daysUntil?: number; // 距離到期/逾期天數（負數 = 已過）
  amount?: number; // 涉及金額（NT$）
  metadata?: Record<string, unknown>;
  createdAt: string; // 警示計算時間（ISO）
}

/**
 * 掃描所有計費警示
 */
export async function scanBillingAlerts(): Promise<BillingAlert[]> {
  const now = new Date();
  const alerts: BillingAlert[] = [];

  // 一次抓所有 active subscriptions（含 fieldId）
  const allSubs = await db.query.fieldSubscriptions.findMany({
    where: ne(fieldSubscriptions.status, "cancelled"),
  });

  // 一次抓所有 fields 名稱
  const fieldIds = Array.from(
    new Set(allSubs.map((s) => s.fieldId).filter(Boolean) as string[]),
  );
  const fieldList = fieldIds.length
    ? await db.query.fields.findMany({
        where: inArray(fields.id, fieldIds),
        columns: { id: true, name: true, code: true },
      })
    : [];
  const fieldMap = new Map(fieldList.map((f) => [f.id, f]));

  // ────────────────────────────────────────
  // 1. 訂閱到期警示（expiring_soon / expired）
  // ────────────────────────────────────────
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const sub of allSubs) {
    if (!sub.expiresAt) continue; // 永久訂閱跳過

    const expiresAt = new Date(sub.expiresAt);
    const daysUntil = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    const field = sub.fieldId ? fieldMap.get(sub.fieldId) : undefined;
    if (!sub.fieldId || !field) continue;

    if (expiresAt < now) {
      // 已過期
      alerts.push({
        id: `expired:${sub.fieldId}:${sub.id}`,
        type: "expired",
        severity: "critical",
        fieldId: sub.fieldId,
        field,
        title: `訂閱已過期：${field.name}`,
        message: `訂閱於 ${expiresAt.toLocaleDateString("zh-TW")} 過期（${Math.abs(daysUntil)} 天前），但場域狀態仍為 ${sub.status}`,
        daysUntil,
        metadata: {
          subscriptionId: sub.id,
          planId: sub.planId,
          status: sub.status,
        },
        createdAt: now.toISOString(),
      });
    } else if (expiresAt <= in30days) {
      // 30 天內到期
      const severity: BillingAlertSeverity =
        daysUntil <= 7 ? "urgent" : daysUntil <= 14 ? "warning" : "info";
      alerts.push({
        id: `expiring:${sub.fieldId}:${sub.id}`,
        type: "expiring_soon",
        severity,
        fieldId: sub.fieldId,
        field,
        title: `訂閱將於 ${daysUntil} 天後到期：${field.name}`,
        message: `${field.code} 訂閱在 ${expiresAt.toLocaleDateString("zh-TW")} 到期`,
        daysUntil,
        metadata: {
          subscriptionId: sub.id,
          planId: sub.planId,
          billingCycle: sub.billingCycle,
        },
        createdAt: now.toISOString(),
      });
    }
  }

  // ────────────────────────────────────────
  // 2. 失敗交易（failed_payment）
  //    最近 30 天內 status = failed 的 transaction
  // ────────────────────────────────────────
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const failedTxs = await db.query.platformTransactions.findMany({
    where: and(
      eq(platformTransactions.status, "failed"),
      gte(platformTransactions.createdAt, past30),
    ),
    orderBy: [platformTransactions.createdAt],
  });

  // 補抓尚未 enrich 的 fields
  const failedTxFieldIds = Array.from(
    new Set(failedTxs.map((t) => t.fieldId).filter(Boolean) as string[]),
  );
  const missingFieldIds = failedTxFieldIds.filter((id) => !fieldMap.has(id));
  if (missingFieldIds.length) {
    const more = await db.query.fields.findMany({
      where: inArray(fields.id, missingFieldIds),
      columns: { id: true, name: true, code: true },
    });
    more.forEach((f) => fieldMap.set(f.id, f));
  }

  for (const tx of failedTxs) {
    const field = tx.fieldId ? fieldMap.get(tx.fieldId) : undefined;
    if (!tx.fieldId || !field) continue;
    alerts.push({
      id: `failed:${tx.fieldId}:${tx.id}`,
      type: "failed_payment",
      severity: "urgent",
      fieldId: tx.fieldId,
      field,
      title: `交易失敗：${field.name}`,
      message: `${tx.invoiceNumber ? `#${tx.invoiceNumber}` : tx.id} · ${tx.description ?? tx.type} · NT$${(tx.amount ?? 0).toLocaleString()}`,
      amount: tx.amount,
      metadata: {
        transactionId: tx.id,
        type: tx.type,
        invoiceNumber: tx.invoiceNumber,
        createdAt: tx.createdAt,
      },
      createdAt: now.toISOString(),
    });
  }

  // ────────────────────────────────────────
  // 3. 逾期未付款（overdue）
  //    status = pending 但 dueAt < now
  // ────────────────────────────────────────
  const overdueTxs = await db.query.platformTransactions.findMany({
    where: and(
      eq(platformTransactions.status, "pending"),
      isNotNull(platformTransactions.dueAt),
      lt(platformTransactions.dueAt, now),
    ),
    orderBy: [platformTransactions.dueAt],
  });

  const overdueFieldIds = Array.from(
    new Set(overdueTxs.map((t) => t.fieldId).filter(Boolean) as string[]),
  );
  const stillMissing = overdueFieldIds.filter((id) => !fieldMap.has(id));
  if (stillMissing.length) {
    const more = await db.query.fields.findMany({
      where: inArray(fields.id, stillMissing),
      columns: { id: true, name: true, code: true },
    });
    more.forEach((f) => fieldMap.set(f.id, f));
  }

  for (const tx of overdueTxs) {
    const field = tx.fieldId ? fieldMap.get(tx.fieldId) : undefined;
    if (!tx.fieldId || !field || !tx.dueAt) continue;
    const dueAt = new Date(tx.dueAt);
    const daysOverdue = Math.floor((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000));
    const severity: BillingAlertSeverity =
      daysOverdue >= 30 ? "critical" : daysOverdue >= 7 ? "urgent" : "warning";
    alerts.push({
      id: `overdue:${tx.fieldId}:${tx.id}`,
      type: "overdue",
      severity,
      fieldId: tx.fieldId,
      field,
      title: `付款逾期 ${daysOverdue} 天：${field.name}`,
      message: `${tx.invoiceNumber ? `#${tx.invoiceNumber}` : tx.id} · 應於 ${dueAt.toLocaleDateString("zh-TW")} 前付款 · NT$${(tx.amount ?? 0).toLocaleString()}`,
      daysUntil: -daysOverdue,
      amount: tx.amount,
      metadata: {
        transactionId: tx.id,
        type: tx.type,
        invoiceNumber: tx.invoiceNumber,
        dueAt: tx.dueAt,
      },
      createdAt: now.toISOString(),
    });
  }

  // 排序：critical → urgent → warning → info；同 severity 依 daysUntil 升冪
  const severityRank: Record<BillingAlertSeverity, number> = {
    critical: 0,
    urgent: 1,
    warning: 2,
    info: 3,
  };
  alerts.sort((a, b) => {
    const sa = severityRank[a.severity] ?? 99;
    const sb = severityRank[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.daysUntil ?? 0) - (b.daysUntil ?? 0);
  });

  return alerts;
}

/**
 * 統計 — 給 dashboard 緊急徽章用
 */
export async function getBillingAlertSummary(): Promise<{
  total: number;
  critical: number;
  urgent: number;
  warning: number;
  info: number;
  byType: Record<string, number>;
}> {
  const alerts = await scanBillingAlerts();
  const byType: Record<string, number> = {};
  let critical = 0;
  let urgent = 0;
  let warning = 0;
  let info = 0;

  for (const a of alerts) {
    byType[a.type] = (byType[a.type] || 0) + 1;
    if (a.severity === "critical") critical++;
    else if (a.severity === "urgent") urgent++;
    else if (a.severity === "warning") warning++;
    else info++;
  }

  return {
    total: alerts.length,
    critical,
    urgent,
    warning,
    info,
    byType,
  };
}
