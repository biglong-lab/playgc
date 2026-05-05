import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EnergyBoost, { EnergyBoostConfig, EnergyBoostState, EnergyCard } from "../EnergyBoost";

const baseConfig: EnergyBoostConfig = {
  title: "能量加速器測試",
  prompt: "送出你的能量！",
  maxLength: 40,
  emojis: ["⚡", "🔥", "💪"],
};

const emptyState: EnergyBoostState = { cards: [], revealed: false };

const cards: EnergyCard[] = [
  { cardId: "c1", fromUserId: "u1", fromUserName: "Alice", toName: "David", emoji: "⚡", message: "你很棒！" },
  { cardId: "c2", fromUserId: "u2", fromUserName: "Bob", toName: "David", emoji: "🔥", message: "繼續加油！" },
  { cardId: "c3", fromUserId: "u3", fromUserName: "Carol", toName: "Eve", emoji: "💪", message: "你是最強的" },
];

const revealedState: EnergyBoostState = { cards, revealed: true };

function renderEb(overrides: Partial<Parameters<typeof EnergyBoost>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    myUserName: "David",
    onSend: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<EnergyBoost {...props} />), props };
}

describe("EnergyBoost — 基本渲染", () => {
  it("顯示標題", () => {
    renderEb();
    expect(screen.getByTestId("eb-title")).toHaveTextContent("能量加速器測試");
  });

  it("顯示 prompt", () => {
    renderEb();
    expect(screen.getByTestId("eb-prompt")).toHaveTextContent("送出你的能量！");
  });

  it("顯示收件人輸入框", () => {
    renderEb();
    expect(screen.getByTestId("eb-to-input")).toBeInTheDocument();
  });

  it("顯示訊息輸入框", () => {
    renderEb();
    expect(screen.getByTestId("eb-msg-input")).toBeInTheDocument();
  });

  it("顯示 emoji 選項", () => {
    renderEb();
    expect(screen.getByTestId("eb-emoji-row")).toBeInTheDocument();
    expect(screen.getByTestId("eb-emoji-⚡")).toBeInTheDocument();
    expect(screen.getByTestId("eb-emoji-🔥")).toBeInTheDocument();
  });

  it("顯示公布按鈕", () => {
    renderEb();
    expect(screen.getByTestId("eb-reveal-btn")).toBeInTheDocument();
  });
});

describe("EnergyBoost — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderEb();
    expect(screen.getByTestId("eb-send-btn")).toBeDisabled();
  });

  it("有收件人和訊息後送出鈕可點", () => {
    renderEb();
    fireEvent.change(screen.getByTestId("eb-to-input"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByTestId("eb-msg-input"), { target: { value: "加油！" } });
    expect(screen.getByTestId("eb-send-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSend 帶正確資料", () => {
    const onSend = vi.fn();
    renderEb({ onSend });
    fireEvent.change(screen.getByTestId("eb-to-input"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByTestId("eb-msg-input"), { target: { value: "加油！" } });
    fireEvent.click(screen.getByTestId("eb-send-btn"));
    expect(onSend).toHaveBeenCalledWith("Alice", "⚡", "加油！");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderEb({ onReveal });
    fireEvent.click(screen.getByTestId("eb-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已送出卡片顯示 eb-my-count", () => {
    const myCard: EnergyCard = {
      cardId: "c99",
      fromUserId: "u4",
      fromUserName: "David",
      toName: "Alice",
      emoji: "⚡",
      message: "加油",
    };
    renderEb({ state: { cards: [myCard], revealed: false } });
    expect(screen.getByTestId("eb-my-count")).toBeInTheDocument();
  });

  it("顯示總卡片數", () => {
    renderEb({ state: { cards, revealed: false } });
    expect(screen.getByTestId("eb-count")).toHaveTextContent("3");
  });
});

describe("EnergyBoost — 公布結果", () => {
  it("公布後顯示 eb-result", () => {
    renderEb({ state: revealedState });
    expect(screen.getByTestId("eb-result")).toBeInTheDocument();
  });

  it("顯示 myUserName 收到的能量卡（David）", () => {
    renderEb({ state: revealedState });
    expect(screen.getByTestId("eb-my-received")).toBeInTheDocument();
    expect(screen.getByTestId("eb-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("eb-card-c2")).toBeInTheDocument();
  });

  it("顯示所有卡片", () => {
    renderEb({ state: revealedState });
    expect(screen.getByTestId("eb-all-c1")).toBeInTheDocument();
    expect(screen.getByTestId("eb-all-c2")).toBeInTheDocument();
    expect(screen.getByTestId("eb-all-c3")).toBeInTheDocument();
  });

  it("顯示總卡片數", () => {
    renderEb({ state: revealedState });
    expect(screen.getByTestId("eb-total")).toHaveTextContent("3");
  });

  it("沒有收到能量時顯示 eb-no-received（非 David 的 userId）", () => {
    renderEb({ state: revealedState, myUserName: "Eve2" });
    expect(screen.queryByTestId("eb-my-received")).not.toBeInTheDocument();
    expect(screen.getByTestId("eb-no-received")).toBeInTheDocument();
  });

  it("無卡片顯示 eb-empty", () => {
    renderEb({ state: { cards: [], revealed: true } });
    expect(screen.getByTestId("eb-empty")).toBeInTheDocument();
  });
});
