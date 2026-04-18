// SaaS 計費引擎 — 純邏輯單元測試
// 驗證 checkQuota / recordTransactionFee / incrementUsage 的分支（不依賴 DB）
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB（避免載入 drizzle + 真實連線）
const mockFindFirst = vi.fn();
const mockSelectLimit = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateReturning = vi.fn();

function makeSelect() {
  const builder: any = {
    from: () => builder,
    leftJoin: () => builder,
    where: () => builder,
    limit: (...args: unknown[]) => mockSelectLimit(...args),
  };
  return builder;
}

function makeInsert() {
  const builder: any = {
    values: (v: unknown) => {
      const result = mockInsertValues(v);
      // 同時支援 .returning() 和直接 await
      return Object.assign(Promise.resolve(result), {
        returning: () => Promise.resolve(result ?? [{}]),
      });
    },
  };
  return builder;
}

function makeUpdate() {
  const builder: any = {
    set: () => ({
      where: () => ({
        returning: () => mockUpdateReturning(),
      }),
    }),
  };
  return builder;
}

vi.mock("../db", () => ({
  db: {
    query: {
      fieldUsageMeters: {
        get findFirst() {
          return mockFindFirst;
        },
      },
    },
    select: () => makeSelect(),
    insert: () => makeInsert(),
    update: () => makeUpdate(),
  },
}));

// Mock schema exports（簡化為 identity）
vi.mock("@shared/schema", () => ({
  fieldUsageMeters: { fieldId: "fieldId", meterKey: "meterKey", periodStart: "periodStart", id: "id" },
  fieldSubscriptions: {},
  platformPlans: {},
  platformTransactions: {},
  fields: {},
  games: { fieldId: "fieldId" },
  parsePlanLimits: (l: unknown) => l ?? {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: Object.assign(vi.fn(() => ({})), { raw: vi.fn() }),
  gte: vi.fn(() => ({})),
  lt: vi.fn(() => ({})),
}));

import { checkQuota, recordTransactionFee, incrementUsage } from "../services/billing";

describe("SaaS 計費 — checkQuota", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSelectLimit.mockReset();
    mockInsertValues.mockReset();
    mockUpdateReturning.mockReset();
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

describe("SaaS 計費 — recordTransactionFee", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSelectLimit.mockReset();
    mockInsertValues.mockReset();
  });

  it("無訂閱 → 回傳 null", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    const result = await recordTransactionFee({
      fieldId: "field-1",
      sourceTransactionId: "tx-1",
      sourceAmount: 100,
    });

    expect(result).toBeNull();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("費率為 0 → 不建立交易（免費方案）", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customFeePercent: null },
        plan: { id: "plan-free", transactionFeePercent: "0" },
      },
    ]);

    const result = await recordTransactionFee({
      fieldId: "field-1",
      sourceTransactionId: "tx-1",
      sourceAmount: 100,
    });

    expect(result).toBeNull();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("5% 抽成 → 回傳 feeAmount + 插入交易", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customFeePercent: null },
        plan: { id: "plan-free", transactionFeePercent: "5" },
      },
    ]);
    mockInsertValues.mockResolvedValueOnce([{ id: "pt-1" }]);

    const result = await recordTransactionFee({
      fieldId: "field-1",
      sourceTransactionId: "tx-100",
      sourceAmount: 200,
    });

    expect(result).toEqual({ feeAmount: 10, feePercent: 5 });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldId: "field-1",
        type: "transaction_fee",
        amount: 10,
        status: "pending",
        sourceTransactionId: "tx-100",
      }),
    );
  });

  it("場域自訂費率優先於方案費率", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customFeePercent: "15" }, // 戰略合作自訂 15%
        plan: { id: "plan-pro", transactionFeePercent: "3" },
      },
    ]);
    mockInsertValues.mockResolvedValueOnce([{ id: "pt-2" }]);

    const result = await recordTransactionFee({
      fieldId: "field-revshare",
      sourceTransactionId: "tx-200",
      sourceAmount: 1000,
    });

    expect(result).toEqual({ feeAmount: 150, feePercent: 15 });
  });

  it("四捨五入到整數（5.5% × 100 = 5.5 → 6）", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customFeePercent: null },
        plan: { id: "plan", transactionFeePercent: "5.5" },
      },
    ]);
    mockInsertValues.mockResolvedValueOnce([{ id: "pt-3" }]);

    const result = await recordTransactionFee({
      fieldId: "field-1",
      sourceTransactionId: "tx-r",
      sourceAmount: 100,
    });

    expect(result?.feeAmount).toBe(6); // Math.round(5.5) = 6
  });
});

describe("SaaS 計費 — incrementUsage", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSelectLimit.mockReset();
    mockInsertValues.mockReset();
    mockUpdateReturning.mockReset();
  });

  it("首次計量 → 建立新 meter 記錄", async () => {
    // 取配額（回傳 pro 方案）
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customLimits: null },
        plan: { id: "plan-pro", limits: { maxCheckoutsPerMonth: 1000 } },
      },
    ]);
    // 找現有 meter → null
    mockFindFirst.mockResolvedValueOnce(undefined);
    mockInsertValues.mockResolvedValueOnce([{ currentValue: 1 }]);

    const result = await incrementUsage("field-1", "checkouts", 1);

    expect(result).toBe(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldId: "field-1",
        meterKey: "checkouts",
        currentValue: 1,
        limitValue: 1000,
      }),
    );
  });

  it("已有 meter → 累加 currentValue", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customLimits: null },
        plan: { id: "plan-free", limits: { maxCheckoutsPerMonth: 100 } },
      },
    ]);
    mockFindFirst.mockResolvedValueOnce({
      id: "meter-1",
      currentValue: 50,
      overageCount: 0,
    });
    mockUpdateReturning.mockResolvedValueOnce([{ currentValue: 51 }]);

    const result = await incrementUsage("field-1", "checkouts", 1);

    expect(result).toBe(51);
  });

  it("無限方案（limit=-1）→ 不計 overage", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customLimits: null },
        plan: { id: "plan-enterprise", limits: { maxCheckoutsPerMonth: -1 } },
      },
    ]);
    mockFindFirst.mockResolvedValueOnce(undefined);
    mockInsertValues.mockResolvedValueOnce([{ currentValue: 99999 }]);

    const result = await incrementUsage("field-1", "checkouts", 99999);

    expect(result).toBe(99999);
    // limitValue 應存 null（-1 → 無限）
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ limitValue: null }),
    );
  });

  it("自訂 limits 覆蓋方案 limits", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        sub: { id: "sub-1", customLimits: { maxCheckoutsPerMonth: 500 } },
        plan: { id: "plan-free", limits: { maxCheckoutsPerMonth: 100 } },
      },
    ]);
    mockFindFirst.mockResolvedValueOnce(undefined);
    mockInsertValues.mockResolvedValueOnce([{ currentValue: 1 }]);

    await incrementUsage("field-vip", "checkouts", 1);

    // 應使用自訂的 500（不是方案的 100）
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ limitValue: 500 }),
    );
  });
});
