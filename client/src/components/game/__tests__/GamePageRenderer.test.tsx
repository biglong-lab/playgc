/**
 * GamePageRenderer 測試 — 驗證頁面類型對應元件分發
 * React.lazy 元件需 async 渲染，使用 waitFor 等待 Suspense 解析
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Page } from "@shared/schema";

// 批次 mock 所有遊戲頁面元件
vi.mock("@/components/game/TextCardPage", () => ({ default: () => <div data-testid="text_card" /> }));
vi.mock("@/components/game/DialoguePage", () => ({ default: () => <div data-testid="dialogue" /> }));
vi.mock("@/components/game/VideoPage", () => ({ default: () => <div data-testid="video" /> }));
vi.mock("@/components/game/ButtonPage", () => ({ default: () => <div data-testid="button" /> }));
vi.mock("@/components/game/TextVerifyPage", () => ({ default: () => <div data-testid="text_verify" /> }));
vi.mock("@/components/game/ChoiceVerifyPage", () => ({ default: () => <div data-testid="choice_verify" /> }));
vi.mock("@/components/game/ConditionalVerifyPage", () => ({ default: () => <div data-testid="conditional_verify" /> }));
vi.mock("@/components/game/ShootingMissionPage", () => ({ default: () => <div data-testid="shooting_mission" /> }));
vi.mock("@/components/game/PhotoMissionPage", () => ({ default: () => <div data-testid="photo_mission" /> }));
vi.mock("@/components/game/GpsMissionPage", () => ({ default: () => <div data-testid="gps_mission" /> }));
vi.mock("@/components/game/QrScanPage", () => ({ default: () => <div data-testid="qr_scan" /> }));
vi.mock("@/components/game/TimeBombPage", () => ({ default: () => <div data-testid="time_bomb" /> }));
vi.mock("@/components/game/LockPage", () => ({ default: () => <div data-testid="lock" /> }));
vi.mock("@/components/game/MotionChallengePage", () => ({ default: () => <div data-testid="motion_challenge" /> }));
vi.mock("@/components/game/VotePage", () => ({ default: () => <div data-testid="vote" /> }));
vi.mock("@/components/game/FlowRouterPage", () => ({ default: () => <div data-testid="flow_router" /> }));

import GamePageRenderer from "@/components/game/GamePageRenderer";

function createPage(pageType: string): Page {
  return {
    id: "page-1",
    gameId: "game-1",
    chapterId: null,
    title: "測試頁面",
    pageType,
    sortOrder: 0,
    config: {},
    events: [],
    rewards: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Page;
}

const defaultProps = {
  onComplete: vi.fn(),
  onVariableUpdate: vi.fn(),
  sessionId: "session-1",
  gameId: "game-1",
  variables: {},
  inventory: [],
  score: 0,
};

describe("GamePageRenderer", () => {
  const supportedTypes = [
    "text_card", "dialogue", "video", "button",
    "text_verify", "choice_verify", "conditional_verify",
    "shooting_mission", "photo_mission", "gps_mission",
    "qr_scan", "time_bomb", "lock", "motion_challenge", "vote",
  ];

  supportedTypes.forEach((pageType) => {
    it(`pageType="${pageType}" 渲染對應元件`, async () => {
      const page = createPage(pageType);
      render(<GamePageRenderer {...defaultProps} page={page} />);
      await waitFor(() => {
        expect(screen.getByTestId(pageType)).toBeInTheDocument();
      });
    });
  });

  it("未知 pageType 顯示錯誤訊息", async () => {
    const page = createPage("unknown_type");
    render(<GamePageRenderer {...defaultProps} page={page} />);
    await waitFor(() => {
      expect(screen.getByText(/未知頁面類型/)).toBeInTheDocument();
      expect(screen.getByText(/unknown_type/)).toBeInTheDocument();
    });
  });
});
