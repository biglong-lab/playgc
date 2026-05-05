import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkillSwap, { SkillSwapConfig, SkillSwapState, SkillCard } from "../SkillSwap";

const baseConfig: SkillSwapConfig = {
  title: "技能交換牆",
  offerPrompt: "我能提供什麼？",
  wantPrompt: "我想學什麼？",
  maxLength: 15,
  showAuthor: true,
};

const emptyState: SkillSwapState = { cards: [], revealed: false };

const cards: SkillCard[] = [
  { cardId: "c1", userId: "u1", userName: "Alice", offerSkill: "React", wantSkill: "設計", hearts: [] },
  { cardId: "c2", userId: "u2", userName: "Bob", offerSkill: "設計", wantSkill: "React", hearts: ["u1"] },
  { cardId: "c3", userId: "u3", userName: "Carol", offerSkill: "行銷", wantSkill: "Python", hearts: [] },
];

const revealedState: SkillSwapState = { cards, revealed: true };

function renderSs(overrides: Partial<Parameters<typeof SkillSwap>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<SkillSwap {...props} />), props };
}

describe("SkillSwap — 基本渲染", () => {
  it("顯示標題", () => {
    renderSs();
    expect(screen.getByTestId("ss-title")).toHaveTextContent("技能交換牆");
  });

  it("顯示技能卡數量", () => {
    renderSs();
    expect(screen.getByTestId("ss-count")).toBeInTheDocument();
  });

  it("顯示提供技能輸入框", () => {
    renderSs();
    expect(screen.getByTestId("ss-offer-input")).toBeInTheDocument();
  });

  it("顯示想學技能輸入框", () => {
    renderSs();
    expect(screen.getByTestId("ss-want-input")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderSs();
    expect(screen.getByTestId("ss-reveal-btn")).toBeInTheDocument();
  });
});

describe("SkillSwap — 輸入驗證", () => {
  it("空白時送出鈕 disabled", () => {
    renderSs();
    expect(screen.getByTestId("ss-submit-btn")).toBeDisabled();
  });

  it("只填 offer 時送出鈕 disabled", () => {
    renderSs();
    fireEvent.change(screen.getByTestId("ss-offer-input"), { target: { value: "React" } });
    expect(screen.getByTestId("ss-submit-btn")).toBeDisabled();
  });

  it("兩欄都填後送出鈕可點", () => {
    renderSs();
    fireEvent.change(screen.getByTestId("ss-offer-input"), { target: { value: "React" } });
    fireEvent.change(screen.getByTestId("ss-want-input"), { target: { value: "設計" } });
    expect(screen.getByTestId("ss-submit-btn")).not.toBeDisabled();
  });

  it("offer 超過 maxLength 顯示錯誤", () => {
    renderSs();
    fireEvent.change(screen.getByTestId("ss-offer-input"), {
      target: { value: "超過十五個字的技能名稱真的很長喔" },
    });
    expect(screen.getByTestId("ss-offer-error")).toBeInTheDocument();
  });

  it("want 超過 maxLength 顯示錯誤", () => {
    renderSs();
    fireEvent.change(screen.getByTestId("ss-want-input"), {
      target: { value: "超過十五個字的技能名稱真的很長喔" },
    });
    expect(screen.getByTestId("ss-want-error")).toBeInTheDocument();
  });
});

describe("SkillSwap — 送出", () => {
  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderSs({ onSubmit });
    fireEvent.change(screen.getByTestId("ss-offer-input"), { target: { value: "React" } });
    fireEvent.change(screen.getByTestId("ss-want-input"), { target: { value: "設計" } });
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("React", "設計");
  });

  it("已送出顯示 ss-submitted-msg", () => {
    renderSs({
      state: { cards: [cards[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("ss-submitted-msg")).toBeInTheDocument();
  });

  it("已送出時隱藏輸入區", () => {
    renderSs({
      state: { cards: [cards[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("ss-submit-btn")).not.toBeInTheDocument();
  });
});

describe("SkillSwap — 揭曉", () => {
  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderSs({ onReveal });
    fireEvent.click(screen.getByTestId("ss-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示 ss-result", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-result")).toBeInTheDocument();
  });

  it("無技能卡時顯示 ss-empty", () => {
    renderSs({ state: { cards: [], revealed: true } });
    expect(screen.getByTestId("ss-empty")).toBeInTheDocument();
  });

  it("顯示所有技能卡", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("ss-card-c2")).toBeInTheDocument();
  });

  it("顯示提供技能", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-card-offer-c1")).toHaveTextContent("React");
  });

  it("顯示想學技能", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-card-want-c1")).toHaveTextContent("設計");
  });

  it("配對時顯示 ss-match", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-match-c1")).toBeInTheDocument();
    expect(screen.getByTestId("ss-match-c2")).toBeInTheDocument();
  });

  it("無配對的卡片不顯示 ss-match", () => {
    renderSs({ state: revealedState });
    expect(screen.queryByTestId("ss-match-c3")).not.toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderSs({ state: revealedState });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderSs({ config: { ...baseConfig, showAuthor: false }, state: revealedState });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});

describe("SkillSwap — 愛心", () => {
  it("按愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderSs({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("ss-heart-c1"));
    expect(onHeart).toHaveBeenCalledWith("c1");
  });

  it("顯示愛心數量", () => {
    renderSs({ state: revealedState });
    expect(screen.getByTestId("ss-heart-count-c2")).toHaveTextContent("1");
  });

  it("自己已愛心顯示紅心", () => {
    renderSs({ state: revealedState, myUserId: "u1" });
    expect(screen.getByTestId("ss-heart-c2")).toHaveTextContent("❤️");
  });
});
