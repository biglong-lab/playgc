// LockCoop 單元測試
//
// 覆蓋：
//   - 純函式：fnv1aHash 確定性、pickClueIndexForUser 分配
//   - 元件：unlocked / failed / 主畫面三狀態
//   - 互動：onCodeChange / onAttempt / 完整密碼才能按嘗試 / onComplete 觸發

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LockCoop, { fnv1aHash, pickClueIndexForUser } from "../LockCoop";
import type { LockCoopConfig } from "@shared/schema";

// ============================================================================
// 純函式 helpers
// ============================================================================

describe("fnv1aHash", () => {
  it("給定相同 input 永遠回相同 output（確定性）", () => {
    const a = fnv1aHash("test:user-1");
    const b = fnv1aHash("test:user-1");
    expect(a).toBe(b);
  });

  it("不同 input 會打散到不同 hash 值", () => {
    const a = fnv1aHash("session-1:user-a");
    const b = fnv1aHash("session-1:user-b");
    expect(a).not.toBe(b);
  });

  it("回傳正整數（>>> 0 強制無號）", () => {
    const h = fnv1aHash("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });

  it("空字串也能 hash", () => {
    expect(typeof fnv1aHash("")).toBe("number");
  });
});

describe("pickClueIndexForUser", () => {
  it("回傳值落在 [0, totalClues-1] 範圍內", () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickClueIndexForUser(`user-${i}`, "session-x", 4);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("同一 user + session 永遠拿同組線索（重整不變）", () => {
    const idx1 = pickClueIndexForUser("user-1", "session-1", 5);
    const idx2 = pickClueIndexForUser("user-1", "session-1", 5);
    expect(idx1).toBe(idx2);
  });

  it("不同 user 在多數情況分到不同組（公平打散）", () => {
    const indices = new Set<number>();
    for (let i = 0; i < 20; i++) {
      indices.add(pickClueIndexForUser(`user-${i}`, "session-x", 4));
    }
    // 20 個 user 分 4 組應至少分到 2 組（簡單分散性檢查）
    expect(indices.size).toBeGreaterThanOrEqual(2);
  });

  it("totalClues=0 → 回 0（避免除零）", () => {
    expect(pickClueIndexForUser("u", "s", 0)).toBe(0);
  });
});

// ============================================================================
// 元件渲染
// ============================================================================

const baseConfig: LockCoopConfig = {
  digits: 4,
  combination: "1234",
  clues: [
    { text: "前兩位是 12", label: "前兩位" },
    { text: "後兩位是 34", label: "後兩位" },
  ],
  maxAttempts: 5,
};

const baseProps = {
  config: baseConfig,
  myUserId: "user-1",
  sessionId: "session-1",
  memberCount: 2,
  sharedCode: "",
  attempts: 0,
  isUnlocked: false,
  isFailed: false,
  onCodeChange: vi.fn(),
  onAttempt: vi.fn(),
  onComplete: vi.fn(),
};

describe("LockCoop 元件渲染", () => {
  it("isUnlocked → 顯示解鎖成功畫面", () => {
    render(<LockCoop {...baseProps} isUnlocked />);
    expect(screen.getByTestId("lock-coop-unlocked")).toBeInTheDocument();
    expect(screen.getByText(/解鎖成功/)).toBeInTheDocument();
  });

  it("isFailed → 顯示失敗畫面", () => {
    render(<LockCoop {...baseProps} isFailed />);
    expect(screen.getByTestId("lock-coop-failed")).toBeInTheDocument();
    expect(screen.getByText(/挑戰失敗/)).toBeInTheDocument();
  });

  it("正常狀態 → 顯示主畫面 + 標題 + 線索 + 共享輸入", () => {
    render(<LockCoop {...baseProps} />);
    expect(screen.getByTestId("lock-coop")).toBeInTheDocument();
    // 我的線索（依 hash 分配，應是 0 或 1 其中一組）
    const clueText = screen.getByTestId("my-clue-text").textContent;
    expect(["前兩位是 12", "後兩位是 34"]).toContain(clueText);
    // 共享輸入區存在
    expect(screen.getByTestId("lock-coop-input")).toBeInTheDocument();
  });

  it("digit 顯示格數量等於 config.digits", () => {
    render(<LockCoop {...baseProps} config={{ ...baseConfig, digits: 6 }} />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`lock-coop-digit-${i}`)).toBeInTheDocument();
    }
  });

  it("剩餘次數 = maxAttempts - attempts", () => {
    render(<LockCoop {...baseProps} attempts={2} />);
    expect(screen.getByText(/剩 3 次嘗試/)).toBeInTheDocument();
  });

  it("memberCount 顯示在隊員協作中", () => {
    render(<LockCoop {...baseProps} memberCount={5} />);
    expect(screen.getByText(/5 位隊員協作中/)).toBeInTheDocument();
  });
});

// ============================================================================
// 互動行為
// ============================================================================

describe("LockCoop 互動", () => {
  it("輸入文字 → 觸發 onCodeChange（normalize trim + lowercase）", () => {
    const onCodeChange = vi.fn();
    render(<LockCoop {...baseProps} onCodeChange={onCodeChange} />);
    const input = screen.getByTestId("lock-coop-input");
    fireEvent.change(input, { target: { value: "  ABCD  " } });
    // normalizeAnswer 會 trim + toLowerCase（與 combination 比對時雙方都 normalize）
    expect(onCodeChange).toHaveBeenCalledWith("abcd");
  });

  it("sharedCode 不滿 digits → 嘗試解鎖按鈕 disabled", () => {
    render(<LockCoop {...baseProps} sharedCode="12" />);
    expect(screen.getByTestId("btn-lock-coop-attempt")).toBeDisabled();
  });

  it("sharedCode 滿 digits → 嘗試解鎖按鈕可點", () => {
    render(<LockCoop {...baseProps} sharedCode="1234" />);
    expect(screen.getByTestId("btn-lock-coop-attempt")).not.toBeDisabled();
  });

  it("點嘗試解鎖 → 觸發 onAttempt", () => {
    const onAttempt = vi.fn();
    render(<LockCoop {...baseProps} sharedCode="1234" onAttempt={onAttempt} />);
    fireEvent.click(screen.getByTestId("btn-lock-coop-attempt"));
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it("解鎖成功點繼續 → 觸發 onComplete 帶 reward + nextPageId", () => {
    const onComplete = vi.fn();
    const config: LockCoopConfig = {
      ...baseConfig,
      rewardPoints: 50,
      nextPageId: "page-next-123",
    };
    render(
      <LockCoop {...baseProps} config={config} isUnlocked onComplete={onComplete} />,
    );
    fireEvent.click(screen.getByTestId("btn-lock-coop-continue"));
    expect(onComplete).toHaveBeenCalledWith({ points: 50 }, "page-next-123");
  });

  it("失敗點繼續（跳過） → 觸發 onComplete（無 reward）", () => {
    const onComplete = vi.fn();
    render(<LockCoop {...baseProps} isFailed onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId("btn-lock-coop-skip"));
    expect(onComplete).toHaveBeenCalled();
    // 失敗不給 rewardPoints
    expect(onComplete.mock.calls[0][0]).toBeUndefined();
  });
});
