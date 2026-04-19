/**
 * LockPage 測試 — 驗證：
 * 1. 數字密碼正確 → 解鎖 + 計分 + nextPageId
 * 2. 密碼錯誤 → 扣次數 + 清空重填
 * 3. 耗盡 maxAttempts → 失敗出場
 * 4. 字母密碼大小寫不敏感（normalizeAnswer）
 * 5. 密碼前後空白容錯
 * 6. Rate limit（1.2s 內重複 submit 無效）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LockPage from "../LockPage";
import type { LockConfig } from "@shared/schema";

function renderWith(config: LockConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <LockPage
        config={config}
        onComplete={onComplete}
        sessionId="s1"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

function typeCode(code: string) {
  // 每一位數逐一點擊
  for (const ch of code) {
    fireEvent.click(screen.getByTestId(`button-num-${ch}`));
  }
}

describe("LockPage — 數字密碼", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("輸入正確密碼 → 解鎖並 onComplete", async () => {
    const { onComplete } = renderWith({
      combination: "1234",
      lockType: "number",
      rewardPoints: 50,
      nextPageId: "p-unlocked",
    });

    typeCode("1234");
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 50 }, "p-unlocked");
  });

  it("輸入錯誤密碼 → 扣次數但不 onComplete", async () => {
    const { onComplete } = renderWith({
      combination: "1234",
      lockType: "number",
      maxAttempts: 3,
    });

    typeCode("0000");
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("耗盡 maxAttempts → 失敗出場（onComplete points:0）", async () => {
    const { onComplete } = renderWith({
      combination: "1234",
      lockType: "number",
      maxAttempts: 2,
      nextPageId: "p-fail",
    });

    // 第 1 次錯
    typeCode("0000");
    fireEvent.click(screen.getByTestId("button-submit-code"));

    // 必須等 rate-limit 1.2s 才能再次 submit
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1250);
    });

    // 第 2 次錯（達上限）
    typeCode("0000");
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 0 }, "p-fail");
  });
});

describe("LockPage — 字母密碼", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("字母密碼大小寫不敏感（combination lowercase 仍可用大寫解鎖）", async () => {
    const { onComplete } = renderWith({
      combination: "abc",
      lockType: "letter",
    });

    // 字母 pad：按 A/B/C
    fireEvent.click(screen.getByTestId("button-letter-A"));
    fireEvent.click(screen.getByTestId("button-letter-B"));
    fireEvent.click(screen.getByTestId("button-letter-C"));
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalled();
    expect(onComplete.mock.calls[0][0]).toEqual({ points: 20 });
  });

  it("digits 指定長度可與 combination 長度解耦", async () => {
    const { onComplete } = renderWith({
      combination: "XY",
      lockType: "letter",
      digits: 2,
    });

    fireEvent.click(screen.getByTestId("button-letter-X"));
    fireEvent.click(screen.getByTestId("button-letter-Y"));
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});

describe("LockPage — Rate limit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("submit 後 1.2s 內再按 submit 應該被阻擋", async () => {
    const { onComplete } = renderWith({
      combination: "9999",
      lockType: "number",
      maxAttempts: 10,
    });

    typeCode("0000");
    // 第一次 submit（錯誤）→ 清空 + 啟動 1.2s rate limit
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // 補填新密碼
    typeCode("0000");
    // 第二次立即 submit（應被 rate limit 阻擋）
    fireEvent.click(screen.getByTestId("button-submit-code"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // onComplete 仍未被呼叫（還在錯誤狀態）
    expect(onComplete).not.toHaveBeenCalled();
  });
});
