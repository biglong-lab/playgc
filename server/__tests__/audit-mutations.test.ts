// 全域變更稽核中介層測試（2026-06-13）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// mock logAuditAction（避免真的寫 DB）
const logSpy = vi.fn();
vi.mock("../adminAuth", () => ({
  logAuditAction: (...args: unknown[]) => logSpy(...args),
}));

import { auditMutationMiddleware } from "../middleware/audit-mutations";

function makeReqRes(opts: {
  method: string;
  path: string;
  admin?: { id: string; fieldId?: string };
  body?: unknown;
}) {
  const req = {
    method: opts.method,
    path: opts.path,
    admin: opts.admin,
    body: opts.body ?? {},
    query: {},
    ip: "1.2.3.4",
    headers: { "user-agent": "test" },
  } as unknown as Parameters<typeof auditMutationMiddleware>[0];
  const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as Parameters<typeof auditMutationMiddleware>[1];
  const next = vi.fn();
  return { req, res, next };
}

describe("auditMutationMiddleware", () => {
  beforeEach(() => logSpy.mockClear());

  it("admin POST 成功 → 寫一筆 audit", () => {
    const { req, res, next } = makeReqRes({ method: "POST", path: "/api/admin/refunds", admin: { id: "a1", fieldId: "f1" } });
    auditMutationMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0];
    expect(arg.actorAdminId).toBe("a1");
    expect(arg.action).toBe("http:POST");
    expect(arg.targetId).toBe("/api/admin/refunds");
  });

  it("GET 不稽核", () => {
    const { req, res, next } = makeReqRes({ method: "GET", path: "/api/admin/refunds", admin: { id: "a1" } });
    auditMutationMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("非 admin/pos 路徑不稽核", () => {
    const { req, res, next } = makeReqRes({ method: "POST", path: "/api/bookings", admin: { id: "a1" } });
    auditMutationMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("失敗請求(4xx)不稽核", () => {
    const { req, res, next } = makeReqRes({ method: "POST", path: "/api/admin/refunds", admin: { id: "a1" } });
    auditMutationMiddleware(req, res, next);
    (res as unknown as { statusCode: number }).statusCode = 403;
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("沒有操作者不稽核", () => {
    const { req, res, next } = makeReqRes({ method: "POST", path: "/api/pos/checkout" });
    auditMutationMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("敏感欄位遮罩", () => {
    const { req, res, next } = makeReqRes({
      method: "POST",
      path: "/api/admin/x",
      admin: { id: "a1" },
      body: { password: "secret123", note: "ok" },
    });
    auditMutationMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");
    const arg = logSpy.mock.calls[0][0];
    expect(arg.metadata.body.password).toBe("[redacted]");
    expect(arg.metadata.body.note).toBe("ok");
  });

  it("POS mutating 也稽核", () => {
    const { req, res, next } = makeReqRes({ method: "POST", path: "/api/pos/checkout", admin: { id: "a2" } });
    auditMutationMiddleware(req, res, next);
    (res as unknown as EventEmitter).emit("finish");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
