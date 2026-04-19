/**
 * ButtonPage 測試 — 驗證 PR5 修復：空陣列 fallback + 按鈕分支
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ButtonPage from "../ButtonPage";
import type { ButtonConfig } from "@shared/schema";

function renderWith(config: ButtonConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <ButtonPage
        config={config}
        onComplete={onComplete}
        sessionId="test-session"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("ButtonPage — PR5 空 buttons fallback", () => {
  it("buttons 為空陣列 → 顯示 fallback UI 並可繼續", () => {
    const { onComplete } = renderWith({
      prompt: "請選擇",
      buttons: [],
    });

    expect(screen.getByText(/本頁無可用選項/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-empty-fallback"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("buttons 未定義 → 同樣顯示 fallback", () => {
    renderWith({ prompt: "test" } as ButtonConfig);
    expect(screen.getByText(/本頁無可用選項/)).toBeTruthy();
  });
});

describe("ButtonPage — 分支路由（nextPageId）", () => {
  it("點選某按鈕 → 傳入對應的 nextPageId + rewardPoints", async () => {
    const { onComplete } = renderWith({
      prompt: "選擇路線",
      buttons: [
        { text: "A 路", nextPageId: "page-A", rewardPoints: 10 },
        { text: "B 路", nextPageId: "page-B", rewardPoints: 20 },
      ],
    });

    fireEvent.click(screen.getByText("B 路"));

    // 等 300ms setTimeout
    await new Promise((r) => setTimeout(r, 350));

    expect(onComplete).toHaveBeenCalledWith(
      { points: 20 },
      "page-B",
    );
  });

  it("按鈕 items 會以 reward.items 傳遞", async () => {
    const { onComplete } = renderWith({
      prompt: "領取物品",
      buttons: [
        { text: "拿鑰匙", items: ["key-1"], nextPageId: "next" },
      ],
    });
    fireEvent.click(screen.getByText("拿鑰匙"));
    await new Promise((r) => setTimeout(r, 350));
    expect(onComplete).toHaveBeenCalledWith(
      { items: ["key-1"] },
      "next",
    );
  });
});

describe("ButtonPage — PR6 randomizeOrder + defaultChoice", () => {
  beforeEach(() => {
    // 固定 Math.random 讓測試可重現（洗牌結果固定）
    vi.spyOn(Math, "random").mockReturnValue(0.1);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("randomizeOrder 不改變 defaultChoice 指向的按鈕內容（_originalIndex 對應）", async () => {
    const { onComplete } = renderWith({
      prompt: "選擇",
      buttons: [
        { text: "A（admin 設為預設）", nextPageId: "page-A", rewardPoints: 5 },
        { text: "B", nextPageId: "page-B", rewardPoints: 10 },
        { text: "C", nextPageId: "page-C", rewardPoints: 15 },
      ],
      randomizeOrder: true,
      defaultChoice: 0, // admin 原意：時間到選第 0 個（A）
      timeLimit: 1,
    });

    // 等 timer 過期 + setTimeout(300) 動畫
    await new Promise((r) => setTimeout(r, 1600));

    // 即使洗牌後 A 位置不一，仍應走 A 的 nextPageId/rewardPoints
    expect(onComplete).toHaveBeenCalledWith(
      { points: 5 },
      "page-A",
    );
  });

  it("defaultChoice 未設時預設第 0 個原按鈕", async () => {
    const { onComplete } = renderWith({
      prompt: "選擇",
      buttons: [
        { text: "第一個（預設）", nextPageId: "p1" },
        { text: "第二個", nextPageId: "p2" },
      ],
      timeLimit: 1,
    });

    await new Promise((r) => setTimeout(r, 1600));

    expect(onComplete).toHaveBeenCalledWith(
      undefined,
      "p1",
    );
  });
});
