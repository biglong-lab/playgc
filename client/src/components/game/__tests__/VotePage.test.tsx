/**
 * VotePage 測試 — 驗證投票核心流程（三輪修復後的防護網）
 *
 * 覆蓋：
 * 1. 投完票即可繼續下一關（hasVoted → canContinue）
 * 2. 自動前進倒數（autoAdvanceSeconds）完成後呼叫 onComplete
 * 3. nextPageStrategy="winner" 走最多票選項
 * 4. nextPageStrategy="self" 走玩家自己選的選項
 * 5. 投完票顯示結果面板 + 勝選提示
 * 6. options 為空時顯示跳過 fallback
 * 7. isAdvancing 防重複觸發
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import VotePage from "../VotePage";
import type { VoteConfig } from "@shared/schema";

function renderWith(config: VoteConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <VotePage
        config={config}
        onComplete={onComplete}
        sessionId="s-test"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("VotePage — 核心投票流程", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("投完票後繼續鈕可點，按下進入下一關（走 winner 策略）", async () => {
    const { onComplete } = renderWith({
      question: "往哪走？",
      options: [
        { text: "東", nextPageId: "east" },
        { text: "西", nextPageId: "west" },
      ],
      nextPageStrategy: "winner",
      autoAdvanceSeconds: 0, // 關閉自動前進，手動驗證
    });

    // 選東 → 確認投票
    fireEvent.click(screen.getByText("東"));
    fireEvent.click(screen.getByTestId("button-submit-vote"));

    // 投票動畫 500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // 按繼續鈕
    fireEvent.click(screen.getByTestId("button-continue"));

    expect(onComplete).toHaveBeenCalledWith(undefined, "east");
  });

  it("autoAdvanceSeconds > 0 時倒數結束自動前進", async () => {
    const { onComplete } = renderWith({
      question: "選一個",
      options: [
        { text: "A", nextPageId: "a" },
        { text: "B", nextPageId: "b" },
      ],
      autoAdvanceSeconds: 3,
    });

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByTestId("button-submit-vote"));

    // 投票動畫 500ms + autoAdvance 倒數 3s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600 + 3100);
    });

    expect(onComplete).toHaveBeenCalledWith(undefined, "a");
  });

  it("nextPageStrategy='self' 時一律走玩家自選選項", async () => {
    const { onComplete } = renderWith({
      question: "",
      options: [
        { text: "A", nextPageId: "pa" },
        { text: "B", nextPageId: "pb" },
      ],
      nextPageStrategy: "self",
      autoAdvanceSeconds: 0,
    });

    fireEvent.click(screen.getByText("B"));
    fireEvent.click(screen.getByTestId("button-submit-vote"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalledWith(undefined, "pb");
  });

  it("投完票自動顯示結果（voteResults）", async () => {
    renderWith({
      question: "Q",
      options: [
        { text: "選項一" },
        { text: "選項二" },
      ],
      autoAdvanceSeconds: 0,
    });

    fireEvent.click(screen.getByText("選項一"));
    fireEvent.click(screen.getByTestId("button-submit-vote"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // 結果區塊顯示總票數
    expect(screen.getByText(/總投票數/)).toBeTruthy();
    // 投票結果：第一個選項 100%（唯一票數）
    expect(screen.getByText(/100%/)).toBeTruthy();
  });

  it("options 空陣列 → 顯示 fallback 並可跳過", () => {
    const { onComplete } = renderWith({
      question: "",
      options: [],
    });

    expect(screen.getByText(/投票設定不完整/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-skip-vote"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("isAdvancing 防重複：連點繼續鈕只觸發一次 onComplete", async () => {
    const { onComplete } = renderWith({
      question: "",
      options: [{ text: "X", nextPageId: "x" }],
      autoAdvanceSeconds: 0,
    });

    fireEvent.click(screen.getByText("X"));
    fireEvent.click(screen.getByTestId("button-submit-vote"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // 連點 3 次
    const continueBtn = screen.getByTestId("button-continue");
    fireEvent.click(continueBtn);
    fireEvent.click(continueBtn);
    fireEvent.click(continueBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("Enter 鍵在已選擇狀態送出投票", async () => {
    const { onComplete } = renderWith({
      question: "",
      options: [{ text: "Only", nextPageId: "only" }],
      autoAdvanceSeconds: 0,
    });

    fireEvent.click(screen.getByText("Only"));
    // 模擬 Enter 鍵（非 IME composing）
    fireEvent.keyDown(window, { key: "Enter" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalledWith(undefined, "only");
  });
});
