// multi-sessions-alert 告警過濾/計分測試（2026-07-06）
// 鎖住：排除 demo/測試遊戲 + anomalyScore 計分 + 門檻 30
import { describe, it, expect } from "vitest";

// 與 cron 一致的規則（複製為純函式測試，避免 import 整個 db 依賴鏈）
const TEST_TITLE_RE = /test|測試|demo|範例/i;
const CRITICAL_SCORE_THRESHOLD = 30;

function shouldAlert(input: {
  isDemo: boolean;
  gameTitle: string | null;
  graceCount: number;
  autoLeaveCount: number;
  kickCount: number;
  errorCount: number;
}): boolean {
  // 排除 demo / 測試遊戲
  if (input.isDemo) return false;
  if (input.gameTitle && TEST_TITLE_RE.test(input.gameTitle)) return false;
  const score =
    input.graceCount * 5 + input.autoLeaveCount * 10 + input.errorCount * 8 + input.kickCount * 3;
  return score >= CRITICAL_SCORE_THRESHOLD;
}

describe("multi-sessions-alert 過濾", () => {
  it("demo 遊戲不告警（即使異常分數很高）", () => {
    expect(shouldAlert({ isDemo: true, gameTitle: "婚禮體驗", graceCount: 5, autoLeaveCount: 5, kickCount: 0, errorCount: 0 })).toBe(false);
  });

  it("測試遊戲（title 含 test/測試/demo/範例）不告警", () => {
    for (const title of ["test1", "測試場", "demo 婚禮", "範例遊戲", "TEST-A"]) {
      expect(shouldAlert({ isDemo: false, gameTitle: title, graceCount: 0, autoLeaveCount: 3, kickCount: 0, errorCount: 0 })).toBe(false);
    }
  });

  it("回報的 test1 情境（grace=2 auto-leave=2、score=30）→ 過濾後不告警", () => {
    expect(shouldAlert({ isDemo: false, gameTitle: "test1", graceCount: 2, autoLeaveCount: 2, kickCount: 0, errorCount: 0 })).toBe(false);
  });

  it("真實遊戲：門檻 30 — 2 auto-leave(20) 不告警、3 auto-leave(30) 告警", () => {
    const base = { isDemo: false, gameTitle: "賈村水彈對戰", kickCount: 0, errorCount: 0 };
    expect(shouldAlert({ ...base, graceCount: 0, autoLeaveCount: 2 })).toBe(false); // 20 < 30
    expect(shouldAlert({ ...base, graceCount: 0, autoLeaveCount: 3 })).toBe(true); // 30
    expect(shouldAlert({ ...base, graceCount: 2, autoLeaveCount: 2 })).toBe(true); // 30
  });

  it("真實遊戲有 error 仍會告警（error×8）", () => {
    expect(shouldAlert({ isDemo: false, gameTitle: "正式活動", graceCount: 0, autoLeaveCount: 0, kickCount: 0, errorCount: 4 })).toBe(true); // 32
  });
});
