/**
 * ButtonPage 測試 — 驗證 PR5 修復：空陣列 fallback + 按鈕分支
 */
import { describe, it, expect, vi } from "vitest";
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
});
