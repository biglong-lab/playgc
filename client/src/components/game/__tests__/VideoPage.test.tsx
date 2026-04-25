/**
 * VideoPage 核心行為測試 — 特別驗證 PR1 修復 + PR5 UX（videoUrl 壞的 fallback）
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VideoPage from "../VideoPage";
import type { VideoConfig } from "@shared/schema";

function renderWith(config: VideoConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <VideoPage
        config={config}
        onComplete={onComplete}
        sessionId="test-session"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("VideoPage — videoUrl 空字串 fallback", () => {
  it("videoUrl 為空字串 → 顯示「影片未設定」並提供繼續按鈕", () => {
    const { onComplete } = renderWith({
      videoUrl: "",
      nextPageId: "after-video",
      rewardPoints: 5,
    });

    expect(screen.getByText(/影片未設定/)).toBeTruthy();
    // VideoPage 使用 GameErrorView 共用元件，按鈕 testid 為 btn-game-error-skip
    fireEvent.click(screen.getByTestId("btn-game-error-skip"));
    expect(onComplete).toHaveBeenCalledWith({ points: 5 }, "after-video");
  });

  it("videoUrl 只有空白 → trim 後視為無效", () => {
    renderWith({ videoUrl: "   " });
    expect(screen.getByText(/影片未設定/)).toBeTruthy();
  });
});

describe("VideoPage — forceWatch 禁用 skip", () => {
  it("forceWatch=true 時不顯示「跳過」按鈕", () => {
    renderWith({
      videoUrl: "https://example.com/video.mp4",
      forceWatch: true,
    });

    expect(screen.queryByTestId("button-skip-video")).toBeNull();
  });

  it("skipEnabled=false 時也不顯示跳過按鈕", () => {
    renderWith({
      videoUrl: "https://example.com/video.mp4",
      skipEnabled: false,
    });

    expect(screen.queryByTestId("button-skip-video")).toBeNull();
  });
});
