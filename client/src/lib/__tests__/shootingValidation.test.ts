import { describe, it, expect } from "vitest";
import {
  validateHit,
  validateFinalScore,
  isSimulationAllowed,
  MIN_HIT_INTERVAL_MS,
  MAX_SCORE_PER_HIT,
} from "../shootingValidation";

describe("validateHit", () => {
  const baseOpts = {
    score: 100,
    lastHitTime: null,
    currentHitCount: 0,
    requiredHits: 5,
  };

  it("接受正常範圍的分數", () => {
    expect(validateHit({ ...baseOpts, score: 25 }).valid).toBe(true);
    expect(validateHit({ ...baseOpts, score: 50 }).valid).toBe(true);
    expect(validateHit({ ...baseOpts, score: 100 }).valid).toBe(true);
  });

  it("拒絕超過單次上限的分數", () => {
    const r = validateHit({ ...baseOpts, score: 101 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("score_too_high");
  });

  it("拒絕負分", () => {
    const r = validateHit({ ...baseOpts, score: -10 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invalid_score");
  });

  it("拒絕非數字", () => {
    const r = validateHit({ ...baseOpts, score: NaN });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invalid_score");
  });

  it("拒絕 Infinity", () => {
    const r = validateHit({ ...baseOpts, score: Infinity });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("invalid_score");
  });

  it("當兩次 hit 間隔 < MIN_HIT_INTERVAL_MS 時拒絕", () => {
    const now = 10_000;
    const r = validateHit({
      ...baseOpts,
      lastHitTime: now - 10, // 只隔 10ms
      now,
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("too_fast");
  });

  it("間隔 = MIN_HIT_INTERVAL_MS 時接受", () => {
    const now = 10_000;
    const r = validateHit({
      ...baseOpts,
      lastHitTime: now - MIN_HIT_INTERVAL_MS,
      now,
    });
    expect(r.valid).toBe(true);
  });

  it("間隔充分時接受", () => {
    const now = 10_000;
    const r = validateHit({
      ...baseOpts,
      lastHitTime: now - 500,
      now,
    });
    expect(r.valid).toBe(true);
  });

  it("當 hit 數達到 requiredHits * 3 上限時拒絕", () => {
    const r = validateHit({
      ...baseOpts,
      requiredHits: 5,
      currentHitCount: 15, // 5 * 3
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("over_limit");
  });

  it("最低次數上限為 10（避免 requiredHits=1 時上限只有 3）", () => {
    const r = validateHit({
      ...baseOpts,
      requiredHits: 1,
      currentHitCount: 9,
    });
    expect(r.valid).toBe(true); // 9 < 10
    const r2 = validateHit({
      ...baseOpts,
      requiredHits: 1,
      currentHitCount: 10,
    });
    expect(r2.valid).toBe(false);
  });

  it("首次命中（lastHitTime=null）允許", () => {
    const r = validateHit({ ...baseOpts, lastHitTime: null });
    expect(r.valid).toBe(true);
  });
});

describe("validateFinalScore", () => {
  it("hits 總和與 totalScore 一致時通過", () => {
    const r = validateFinalScore({
      hits: [{ score: 100 }, { score: 50 }, { score: 25 }],
      totalScore: 175,
    });
    expect(r.valid).toBe(true);
    expect(r.expectedScore).toBe(175);
  });

  it("totalScore 被 client 竄改時拒絕", () => {
    const r = validateFinalScore({
      hits: [{ score: 100 }, { score: 50 }],
      totalScore: 9999, // 偽造
    });
    expect(r.valid).toBe(false);
    expect(r.expectedScore).toBe(150);
  });

  it("totalScore 超過理論上限時拒絕", () => {
    // 只有 3 次 hit，但分數標為 500（3*100=300 為上限）
    const r = validateFinalScore({
      hits: [{ score: 100 }, { score: 100 }, { score: 100 }],
      totalScore: 500,
    });
    expect(r.valid).toBe(false);
  });

  it("空 hits 且 totalScore=0 通過", () => {
    const r = validateFinalScore({ hits: [], totalScore: 0 });
    expect(r.valid).toBe(true);
    expect(r.expectedScore).toBe(0);
  });

  it("1 分誤差內容忍（浮點數）", () => {
    const r = validateFinalScore({
      hits: [{ score: 25 }, { score: 50 }],
      totalScore: 75.5,
    });
    expect(r.valid).toBe(true);
  });
});

describe("isSimulationAllowed", () => {
  it("config 為 false 時直接回 false", () => {
    expect(isSimulationAllowed(false)).toBe(false);
    expect(isSimulationAllowed(undefined)).toBe(false);
  });

  it("config 為 true 時依環境決定（測試環境非 production）", () => {
    // Vitest 環境 import.meta.env.PROD 預設為 false
    expect(isSimulationAllowed(true)).toBe(true);
  });
});

describe("常數合理性", () => {
  it("MIN_HIT_INTERVAL_MS 在合理範圍", () => {
    expect(MIN_HIT_INTERVAL_MS).toBeGreaterThanOrEqual(10);
    expect(MIN_HIT_INTERVAL_MS).toBeLessThanOrEqual(500);
  });

  it("MAX_SCORE_PER_HIT 與 bullseye 一致", () => {
    expect(MAX_SCORE_PER_HIT).toBe(100);
  });
});
