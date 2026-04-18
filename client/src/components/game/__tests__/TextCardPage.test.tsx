/**
 * TextCardPage 核心行為測試 — 特別驗證 PR1 修復：nextPageId 正確傳遞
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TextCardPage from "../TextCardPage";
import type { TextCardConfig } from "@shared/schema";

function renderWith(config: TextCardConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <TextCardPage
        config={config}
        onComplete={onComplete}
        sessionId="test-session"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("TextCardPage — PR1 onComplete 簽名修復", () => {
  it("按繼續時呼叫 onComplete 並傳入 config.nextPageId", () => {
    const { onComplete } = renderWith({
      title: "測試",
      content: "這是測試內容",
      nextPageId: "page-next-42",
      rewardPoints: 15,
    });

    const continueBtn = screen.getByRole("button");
    fireEvent.click(continueBtn);

    expect(onComplete).toHaveBeenCalledWith(
      { points: 15 },
      "page-next-42",
    );
  });

  it("沒有 nextPageId 時傳 undefined（走預設下一頁）", () => {
    const { onComplete } = renderWith({
      title: "測試",
      content: "內容",
    });

    fireEvent.click(screen.getByRole("button"));

    expect(onComplete).toHaveBeenCalledWith(undefined, undefined);
  });

  it("rewardPoints 為 0 / undefined 時 reward 為 undefined（避免 falsy 混淆）", () => {
    const { onComplete } = renderWith({
      title: "測試",
      content: "內容",
      nextPageId: "p1",
      // rewardPoints 未設
    });

    fireEvent.click(screen.getByRole("button"));

    expect(onComplete).toHaveBeenCalledWith(undefined, "p1");
  });
});

describe("TextCardPage — 顯示內容", () => {
  it("顯示 title + content", () => {
    renderWith({
      title: "關卡標題",
      content: "這是內容文字",
    });
    expect(screen.getByText("關卡標題")).toBeTruthy();
    expect(screen.getByText(/這是內容文字/)).toBeTruthy();
  });
});
