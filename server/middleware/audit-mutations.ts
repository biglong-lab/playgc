// 全域變更稽核中介層（2026-06-13）
//
// 目的：完備所有後台/現場操作的歷史紀錄 — 任何 admin/POS 的 mutating 請求
// （POST/PUT/PATCH/DELETE）成功後，自動寫一筆 audit_log（操作者 + 時間 + 路徑 +
// body 摘要 + IP），保證零遺漏、未來新增端點也自動涵蓋。
//
// 與既有 logAuditAction 的關係：
//   - 既有語意化 logAuditAction 保留（action 具體、target 明確、metadata 豐富）
//   - 本中介層提供「完整覆蓋」安全網，action 以 `http:` 前綴標記、方便篩選/去重
//
// 掛載：server/routes/index.ts，在 adminAuthMiddleware 之後（req.admin 已就緒）。

import type { Request, Response, NextFunction } from "express";
import { logAuditAction } from "../adminAuth";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// 只稽核後台/現場相關路徑（玩家自助流程另有各自紀錄）
const AUDIT_PATH = /^\/api\/(admin|pos)\b/;
// body 中要遮罩的敏感欄位
const SENSITIVE = /password|token|secret|apikey|api_key|authorization|idtoken|credential/i;

/** 遞迴遮罩敏感欄位、並截斷過大內容 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "…";
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
  return value;
}

export function auditMutationMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method) || !AUDIT_PATH.test(req.path)) {
    return next();
  }

  res.on("finish", () => {
    try {
      // 只記成功的變更（4xx/5xx 代表未生效）
      if (res.statusCode >= 400) return;
      const admin = req.admin;
      const actorUserId = (req as unknown as { user?: { id?: string } }).user?.id;
      // 沒有任何已知操作者就不記（避免匿名雜訊；玩家流程另記）
      if (!admin?.id && !actorUserId) return;

      void logAuditAction({
        actorAdminId: admin?.id,
        actorUserId: admin?.id ? undefined : actorUserId,
        action: `http:${req.method}`,
        targetType: "endpoint",
        targetId: req.path,
        fieldId: admin?.fieldId,
        metadata: {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          query: redact(req.query),
          body: redact(req.body),
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {
      // 稽核失敗不可影響主流程
    }
  });

  next();
}
