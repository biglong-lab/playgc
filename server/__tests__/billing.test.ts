// SaaS 計費引擎 — checkQuota 純邏輯單元測試
// 驗證配額判定規則（不依賴 DB，只測純邏輯分支）
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB（避免載入 drizzle + 真實連線）
const mockFindFirst = vi.fn();
const mockSelect = vi.fn();

vi.mock("../db", () => ({
  db: {
    query: {
      fieldUsageMeters: {
        get findFirst() {
          return mockFindFirst;
        },
      },
    },
    get select() {
      return mockSelect;
    },
  },
}));

// Mock schema exports（簡化為 identity）
vi.mock("@shared/schema", () => ({
  fieldUsageMeters: { fieldId: "fieldId", meterKey: "meterKey", periodStart: "periodStart" },
  fieldSubscriptions: {},
  platformPlans: {},
  platformTransactions: {},
  fields: {},
  games: {},
  parsePlanLimits: (l: unknown) => l ?? {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: Object.assign(vi.fn(() => ({})), { raw: vi.fn() }),
  gte: vi.fn(() => ({})),
  lt: vi.fn(() => ({})),
}));

import { checkQuota } from "../services/billing";

describe("SaaS 計費 — checkQuota", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("無用量記錄 → current=0, limit=null, 不 over", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await checkQuota("field-1", "checkouts");

    expect(result.current).toBe(0);
    expect(result.limit).toBeNull();
    expect(result.isOver).toBe(false);
    expect(result.percent).toBe(0);
  });

  it("用量未超過配額 → isOver=false", async () => {
    mockFindFirst.mockResolvedValue({
      currentValue: 50,
      limitValue: 100,
    });

    const result = await checkQuota("field-1", "checkouts");

    expect(result.current).toBe(50);
    expect(result.limit).toBe(100);
    expect(result.isOver).toBe(false);
    expect(result.percent).toBe(50);
  });

  it("用量超過配額 → isOver=true", async () => {
    mockFindFirst.mockResolvedValue({
      currentValue: 150,
      limitValue: 100,
    });

    const result = await checkQuota("field-1", "checkouts");

    expect(result.current).toBe(150);
    expect(result.limit).toBe(100);
    expect(result.isOver).toBe(true);
    expect(result.percent).toBe(100); // capped at 100
  });

  it("恰好達到配額邊界 → 尚未 over（等於不算 over）", async () => {
    mockFindFirst.mockResolvedValue({
      currentValue: 100,
      limitValue: 100,
    });

    const result = await checkQuota("field-1", "checkouts");

    // current === limit 不算 isOver（嚴格大於才算）
    expect(result.isOver).toBe(false);
    expect(result.percent).toBe(100);
  });

  it("配額為 null（無限）→ 永不 over", async () => {
    mockFindFirst.mockResolvedValue({
      currentValue: 99999,
      limitValue: null,
    });

    const result = await checkQuota("field-1", "checkouts");

    expect(result.limit).toBeNull();
    expect(result.isOver).toBe(false);
    expect(result.percent).toBe(0);
  });

  it("不同 meter key 分別計量", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ currentValue: 5, limitValue: 10 })
      .mockResolvedValueOnce({ currentValue: 20, limitValue: 10 });

    const checkouts = await checkQuota("field-1", "checkouts");
    const battles = await checkQuota("field-1", "battle_slots");

    expect(checkouts.isOver).toBe(false);
    expect(battles.isOver).toBe(true);
  });
});
