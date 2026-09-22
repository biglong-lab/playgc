// 🚫 後台強制取消預約 — 原因必填、至少 5 個字（與前端同規則，錯誤回 400 繁中 message）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockCancelBooking, mockAudit } = vi.hoisted(() => ({
  mockCancelBooking: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock("../db", () => ({ db: {} }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    req.admin = { id: "admin-1", fieldId: "field-1", systemRole: "field_director", permissions: ["game:edit"] };
    return next();
  }),
  requirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  logAuditAction: mockAudit,
}));

vi.mock("../booking/booking-service", () => {
  class BookingError extends Error {
    constructor(public code: string, message: string, public status = 400) {
      super(message);
    }
  }
  return {
    cancelBooking: mockCancelBooking,
    listBookings: vi.fn(),
    markBookingCompleted: vi.fn(),
    markBookingNoShow: vi.fn(),
    createManualBooking: vi.fn(),
    BookingError,
  };
});

vi.mock("../booking/closure-service", () => ({
  validateAndStampClosures: vi.fn(),
  ClosureValidationError: class extends Error {},
}));
vi.mock("../lib/telegram-bot", () => ({ getTelegramStatus: vi.fn(), sendMessage: vi.fn(), getBotInfo: vi.fn() }));
vi.mock("../lib/line-rich-menu", () => ({
  setupBookingRichMenu: vi.fn(),
  generateRichMenuImage: vi.fn(),
  listRichMenus: vi.fn(),
  deleteRichMenu: vi.fn(),
}));

import { registerAdminBookingRoutes } from "../routes/admin-bookings";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminBookingRoutes(app);
  return app;
}

const cancel = (body: unknown) =>
  request(createApp()).post("/api/admin/bookings/BK001/cancel").send(body as object);

describe("POST /api/admin/bookings/:bookingCode/cancel — 取消原因驗證", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelBooking.mockResolvedValue({ bookingCode: "BK001", fieldId: "JIACHUN", status: "cancelled" });
  });

  it("未帶原因 → 400、不取消", async () => {
    const res = await cancel({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("reason_required");
    expect(res.body.message).toBe("請填寫取消原因（至少 5 個字）");
    expect(mockCancelBooking).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("只有空白 → 400", async () => {
    const res = await cancel({ reason: "     " });
    expect(res.status).toBe(400);
    expect(mockCancelBooking).not.toHaveBeenCalled();
  });

  it("不足 5 個字 → 400 並說明還差幾個字", async () => {
    const res = await cancel({ reason: "下雨" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("取消原因至少 5 個字（還差 3 個字）");
    expect(mockCancelBooking).not.toHaveBeenCalled();
  });

  it("原因不是字串 → 400", async () => {
    const res = await cancel({ reason: 12345 });
    expect(res.status).toBe(400);
    expect(mockCancelBooking).not.toHaveBeenCalled();
  });

  it("合法原因 → 200，以去頭尾空白後的原因取消並記稽核", async () => {
    const res = await cancel({ reason: "  颱風停業一天  " });
    expect(res.status).toBe(200);
    expect(mockCancelBooking).toHaveBeenCalledWith({
      bookingCode: "BK001",
      cancelBy: { type: "admin" },
      reason: "颱風停業一天",
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "booking:cancel_admin", metadata: { reason: "颱風停業一天" } }),
    );
  });
});
