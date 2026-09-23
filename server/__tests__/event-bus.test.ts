// 📣 事件匯流排：訂閱者出錯不能拖垮發布端
import { describe, it, expect, vi, beforeEach } from "vitest";
import { emitEvent, onEvent, resetEventBus, subscriberCount } from "../lib/event-bus";

const payload = {
  fieldId: "f1", fieldCode: "TEST", fieldName: "測試場域", planCode: "free",
  source: "admin_create" as const, occurredAt: new Date().toISOString(),
};

beforeEach(() => {
  resetEventBus();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("event-bus", () => {
  it("發布 → 所有訂閱者都收到", () => {
    const a = vi.fn();
    const b = vi.fn();
    onEvent("field.provisioned", a);
    onEvent("field.provisioned", b);
    emitEvent("field.provisioned", payload);
    expect(a).toHaveBeenCalledWith(payload);
    expect(b).toHaveBeenCalledWith(payload);
  });

  it("沒有訂閱者也不會爆", () => {
    expect(() => emitEvent("field.provisioned", payload)).not.toThrow();
  });

  it("訂閱者丟同步錯誤 → 其他訂閱者照跑、發布端不受影響", () => {
    const boom = vi.fn(() => { throw new Error("訂閱者壞了"); });
    const ok = vi.fn();
    onEvent("field.provisioned", boom);
    onEvent("field.provisioned", ok);
    expect(() => emitEvent("field.provisioned", payload)).not.toThrow();
    expect(ok).toHaveBeenCalled();
  });

  it("訂閱者丟非同步錯誤 → 被吞掉並記錄，不會變成 unhandled rejection", async () => {
    onEvent("field.provisioned", async () => { throw new Error("async 壞了"); });
    emitEvent("field.provisioned", payload);
    await new Promise((r) => setTimeout(r, 0));
    expect(console.error).toHaveBeenCalled();
  });

  it("取消訂閱後不再收到", () => {
    const handler = vi.fn();
    const off = onEvent("field.provisioned", handler);
    off();
    emitEvent("field.provisioned", payload);
    expect(handler).not.toHaveBeenCalled();
    expect(subscriberCount("field.provisioned")).toBe(0);
  });
});
