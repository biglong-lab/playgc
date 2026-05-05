import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardDraw from "../CardDraw";
import type { CardDrawConfig, CardDrawState } from "../CardDraw";

const cards = [
  { cardId: "c1", label: "破冰發問者", emoji: "🎤", description: "負責提問" },
  { cardId: "c2", label: "記錄者", emoji: "📝" },
];

const defaultConfig: CardDrawConfig = {
  title: "🎴 抽牌任務",
  cards,
  allowReveal: true,
};

const emptyState: CardDrawState = { draws: [], revealed: false };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onDraw: vi.fn(),
  onReveal: vi.fn(),
};

describe("CardDraw", () => {
  it("顯示標題", () => {
    render(<CardDraw {...mockProps} />);
    expect(screen.getByTestId("cd-title")).toHaveTextContent("抽牌任務");
  });

  it("尚未抽牌顯示抽牌按鈕", () => {
    render(<CardDraw {...mockProps} />);
    expect(screen.getByTestId("cd-draw-btn")).toBeInTheDocument();
  });

  it("點擊抽牌呼叫 onDraw", () => {
    const onDraw = vi.fn();
    render(<CardDraw {...mockProps} onDraw={onDraw} />);
    fireEvent.click(screen.getByTestId("cd-draw-btn"));
    expect(onDraw).toHaveBeenCalled();
  });

  it("已抽牌後顯示我的牌", () => {
    const state = { draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }], revealed: false };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-my-card")).toBeInTheDocument();
    expect(screen.getByTestId("cd-my-label")).toHaveTextContent("破冰發問者");
    expect(screen.getByTestId("cd-my-emoji")).toHaveTextContent("🎤");
  });

  it("已抽牌後隱藏抽牌按鈕", () => {
    const state = { draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }], revealed: false };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.queryByTestId("cd-draw-btn")).not.toBeInTheDocument();
  });

  it("有描述時顯示說明", () => {
    const state = { draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }], revealed: false };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-my-desc")).toHaveTextContent("負責提問");
  });

  it("顯示揭曉按鈕", () => {
    render(<CardDraw {...mockProps} />);
    expect(screen.getByTestId("cd-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    render(<CardDraw {...mockProps} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("cd-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("allowReveal=false 時隱藏揭曉按鈕", () => {
    const config = { ...defaultConfig, allowReveal: false };
    render(<CardDraw {...mockProps} config={config} />);
    expect(screen.queryByTestId("cd-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後顯示所有人的牌", () => {
    const state = {
      draws: [
        { userId: "u1", userName: "Alice", cardId: "c1" },
        { userId: "u2", userName: "Bob", cardId: "c2" },
      ],
      revealed: true,
    };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-all-draws")).toBeInTheDocument();
    expect(screen.getByTestId("cd-draw-u1")).toBeInTheDocument();
    expect(screen.getByTestId("cd-draw-label-u1")).toHaveTextContent("破冰發問者");
    expect(screen.getByTestId("cd-draw-u2")).toBeInTheDocument();
  });

  it("揭曉後顯示 emoji", () => {
    const state = {
      draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }],
      revealed: true,
    };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-draw-emoji-u1")).toHaveTextContent("🎤");
  });

  it("顯示已抽牌人數", () => {
    const state = {
      draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }],
      revealed: false,
    };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-count")).toHaveTextContent("1");
  });

  it("顯示總牌數", () => {
    render(<CardDraw {...mockProps} />);
    expect(screen.getByTestId("cd-total-cards")).toHaveTextContent("2");
  });

  it("揭曉後無人抽牌顯示空白提示", () => {
    const state = { draws: [], revealed: true };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-empty")).toBeInTheDocument();
  });

  it("已抽牌後顯示等待揭曉訊息", () => {
    const state = { draws: [{ userId: "u1", userName: "Alice", cardId: "c1" }], revealed: false };
    render(<CardDraw {...mockProps} state={state} />);
    expect(screen.getByTestId("cd-waiting-msg")).toBeInTheDocument();
  });
});
