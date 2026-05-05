import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PitchVote, { PitchVoteConfig, PitchVoteState, Pitch } from "../PitchVote";

const baseConfig: PitchVoteConfig = {
  title: "創意提案評分",
  prompt: "用一句話說出你的創意",
  maxLength: 30,
  showAuthor: true,
};

const submitState: PitchVoteState = { pitches: [], phase: "submit" };

const pitches: Pitch[] = [
  {
    pitchId: "p1",
    userId: "u1",
    userName: "Alice",
    text: "打造一個共享廚房",
    ratings: [
      { raterId: "u2", score: 5 },
      { raterId: "u3", score: 4 },
    ],
  },
  {
    pitchId: "p2",
    userId: "u2",
    userName: "Bob",
    text: "建立社區菜園",
    ratings: [{ raterId: "u1", score: 3 }],
  },
];

const voteState: PitchVoteState = { pitches, phase: "vote" };
const resultState: PitchVoteState = { pitches, phase: "result" };

function renderPv(overrides: Partial<Parameters<typeof PitchVote>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: submitState,
    myUserId: "u1",
    onSubmitPitch: vi.fn(),
    onRate: vi.fn(),
    onAdvancePhase: vi.fn(),
    ...overrides,
  };
  return { ...render(<PitchVote {...props} />), props };
}

describe("PitchVote — 基本渲染", () => {
  it("顯示標題", () => {
    renderPv();
    expect(screen.getByTestId("pv-title")).toHaveTextContent("創意提案評分");
  });

  it("顯示提示語", () => {
    renderPv();
    expect(screen.getByTestId("pv-prompt")).toHaveTextContent("用一句話說出你的創意");
  });

  it("顯示提案數量", () => {
    renderPv();
    expect(screen.getByTestId("pv-pitch-count")).toBeInTheDocument();
  });

  it("顯示提案階段", () => {
    renderPv();
    expect(screen.getByTestId("pv-phase")).toHaveTextContent("提案");
  });
});

describe("PitchVote — 提案階段", () => {
  it("空白時送出鈕 disabled", () => {
    renderPv();
    expect(screen.getByTestId("pv-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderPv();
    fireEvent.change(screen.getByTestId("pv-pitch-input"), {
      target: { value: "建立共享空間" },
    });
    expect(screen.getByTestId("pv-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderPv({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("pv-pitch-input"), {
      target: { value: "超過五個字的提案啦啦啦" },
    });
    expect(screen.getByTestId("pv-pitch-error")).toBeInTheDocument();
  });

  it("點送出呼叫 onSubmitPitch", () => {
    const onSubmitPitch = vi.fn();
    renderPv({ onSubmitPitch });
    fireEvent.change(screen.getByTestId("pv-pitch-input"), {
      target: { value: "社區花園計畫" },
    });
    fireEvent.click(screen.getByTestId("pv-submit-btn"));
    expect(onSubmitPitch).toHaveBeenCalledWith("社區花園計畫");
  });

  it("已送出顯示 pv-submitted-msg", () => {
    renderPv({
      state: { pitches: [pitches[0]], phase: "submit" },
      myUserId: "u1",
    });
    expect(screen.getByTestId("pv-submitted-msg")).toBeInTheDocument();
  });

  it("點進入評分呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderPv({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("pv-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("PitchVote — 評分階段", () => {
  it("顯示評分階段", () => {
    renderPv({ state: voteState });
    expect(screen.getByTestId("pv-phase")).toHaveTextContent("評分");
  });

  it("每個提案有 5 顆星按鈕", () => {
    renderPv({ state: voteState });
    expect(screen.getByTestId("pv-star-p1-1")).toBeInTheDocument();
    expect(screen.getByTestId("pv-star-p1-5")).toBeInTheDocument();
  });

  it("點星星呼叫 onRate", () => {
    const onRate = vi.fn();
    renderPv({ state: voteState, onRate });
    fireEvent.click(screen.getByTestId("pv-star-p2-4"));
    expect(onRate).toHaveBeenCalledWith("p2", 4);
  });

  it("自己的提案星星 disabled", () => {
    renderPv({ state: voteState, myUserId: "u1" });
    expect(screen.getByTestId("pv-star-p1-3")).toBeDisabled();
  });

  it("點揭曉結果呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderPv({ state: voteState, onAdvancePhase });
    fireEvent.click(screen.getByTestId("pv-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("PitchVote — 結果階段", () => {
  it("顯示結果揭曉", () => {
    renderPv({ state: resultState });
    expect(screen.getByTestId("pv-phase")).toHaveTextContent("結果");
  });

  it("顯示 pv-result", () => {
    renderPv({ state: resultState });
    expect(screen.getByTestId("pv-result")).toBeInTheDocument();
  });

  it("所有提案都顯示", () => {
    renderPv({ state: resultState });
    expect(screen.getByTestId("pv-result-p1")).toBeInTheDocument();
    expect(screen.getByTestId("pv-result-p2")).toBeInTheDocument();
  });

  it("顯示平均分", () => {
    renderPv({ state: resultState });
    expect(screen.getByTestId("pv-result-avg-p1")).toBeInTheDocument();
  });

  it("無提案時顯示 pv-empty", () => {
    renderPv({ state: { pitches: [], phase: "result" } });
    expect(screen.getByTestId("pv-empty")).toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderPv({ state: resultState });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderPv({ config: { ...baseConfig, showAuthor: false }, state: resultState });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
