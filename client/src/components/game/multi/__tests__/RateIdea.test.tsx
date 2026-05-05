import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RateIdea, {
  RateIdeaConfig,
  RateIdeaState,
  IdeaItem,
  IdeaRating,
} from "../RateIdea";

const ideas: IdeaItem[] = [
  { ideaId: "i1", text: "舉辦線下讀書會" },
  { ideaId: "i2", text: "建立內部知識庫" },
  { ideaId: "i3", text: "每週分享午餐" },
];

const baseConfig: RateIdeaConfig = {
  title: "想法評分測試",
  prompt: "為每個想法打星星",
  ideas,
};

const emptyState: RateIdeaState = { ratings: [], revealed: false };

const ratings: IdeaRating[] = [
  { ratingId: "rt1", userId: "u1", userName: "Alice", ideaId: "i1", score: 5 },
  { ratingId: "rt2", userId: "u2", userName: "Bob", ideaId: "i1", score: 3 },
  { ratingId: "rt3", userId: "u1", userName: "Alice", ideaId: "i2", score: 4 },
  { ratingId: "rt4", userId: "u2", userName: "Bob", ideaId: "i2", score: 2 },
  { ratingId: "rt5", userId: "u1", userName: "Alice", ideaId: "i3", score: 2 },
  { ratingId: "rt6", userId: "u2", userName: "Bob", ideaId: "i3", score: 2 },
];

const revealedState: RateIdeaState = { ratings, revealed: true };

function renderRi(overrides: Partial<Parameters<typeof RateIdea>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u3",
    onRate: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<RateIdea {...props} />), props };
}

describe("RateIdea — 基本渲染", () => {
  it("顯示標題", () => {
    renderRi();
    expect(screen.getByTestId("ri-title")).toHaveTextContent("想法評分測試");
  });

  it("顯示說明", () => {
    renderRi();
    expect(screen.getByTestId("ri-prompt")).toHaveTextContent("為每個想法打星星");
  });

  it("顯示所有想法", () => {
    renderRi();
    expect(screen.getByTestId("ri-idea-i1")).toBeInTheDocument();
    expect(screen.getByTestId("ri-idea-i2")).toBeInTheDocument();
    expect(screen.getByTestId("ri-idea-i3")).toBeInTheDocument();
  });

  it("無想法時顯示 ri-empty", () => {
    renderRi({ config: { ...baseConfig, ideas: [] } });
    expect(screen.getByTestId("ri-empty")).toBeInTheDocument();
  });

  it("顯示評分進度", () => {
    renderRi();
    expect(screen.getByTestId("ri-rated-count")).toHaveTextContent("0");
  });
});

describe("RateIdea — 評分互動", () => {
  it("每個想法都有 5 個星星按鈕", () => {
    renderRi();
    expect(screen.getByTestId("ri-star-i1-1")).toBeInTheDocument();
    expect(screen.getByTestId("ri-star-i1-5")).toBeInTheDocument();
  });

  it("點星星呼叫 onRate", () => {
    const onRate = vi.fn();
    renderRi({ onRate });
    fireEvent.click(screen.getByTestId("ri-star-i1-4"));
    expect(onRate).toHaveBeenCalledWith("i1", 4);
  });

  it("點不同想法呼叫 onRate 帶正確 ideaId", () => {
    const onRate = vi.fn();
    renderRi({ onRate });
    fireEvent.click(screen.getByTestId("ri-star-i2-3"));
    expect(onRate).toHaveBeenCalledWith("i2", 3);
  });

  it("已評分後顯示 ri-my-score", () => {
    const myRating: IdeaRating = {
      ratingId: "rt99",
      userId: "u3",
      userName: "Carol",
      ideaId: "i1",
      score: 4,
    };
    renderRi({
      state: { ratings: [myRating], revealed: false },
      myUserId: "u3",
    });
    expect(screen.getByTestId("ri-my-score-i1")).toHaveTextContent("4");
  });

  it("全部評分前公布按鈕 disabled", () => {
    renderRi();
    expect(screen.getByTestId("ri-reveal-btn")).toBeDisabled();
  });

  it("全部評分後公布按鈕可點", () => {
    const allRatings: IdeaRating[] = ideas.map((idea, idx) => ({
      ratingId: `r${idx}`,
      userId: "u3",
      userName: "Carol",
      ideaId: idea.ideaId,
      score: 3,
    }));
    renderRi({
      state: { ratings: allRatings, revealed: false },
      myUserId: "u3",
    });
    expect(screen.getByTestId("ri-reveal-btn")).not.toBeDisabled();
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    const allRatings: IdeaRating[] = ideas.map((idea, idx) => ({
      ratingId: `r${idx}`,
      userId: "u3",
      userName: "Carol",
      ideaId: idea.ideaId,
      score: 3,
    }));
    renderRi({
      state: { ratings: allRatings, revealed: false },
      myUserId: "u3",
      onReveal,
    });
    fireEvent.click(screen.getByTestId("ri-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});

describe("RateIdea — 結果顯示", () => {
  it("公布後顯示 ri-result", () => {
    renderRi({ state: revealedState });
    expect(screen.getByTestId("ri-result")).toBeInTheDocument();
  });

  it("每個想法都有結果區", () => {
    renderRi({ state: revealedState });
    expect(screen.getByTestId("ri-result-i1")).toBeInTheDocument();
    expect(screen.getByTestId("ri-result-i2")).toBeInTheDocument();
    expect(screen.getByTestId("ri-result-i3")).toBeInTheDocument();
  });

  it("i1 平均分 4.0 (5+3)/2", () => {
    renderRi({ state: revealedState });
    expect(screen.getByTestId("ri-avg-i1")).toHaveTextContent("4.0");
  });

  it("i3 平均分 2.0 (2+2)/2", () => {
    renderRi({ state: revealedState });
    expect(screen.getByTestId("ri-avg-i3")).toHaveTextContent("2.0");
  });

  it("顯示進度條", () => {
    renderRi({ state: revealedState });
    expect(screen.getByTestId("ri-bar-i1")).toBeInTheDocument();
  });

  it("無想法時顯示 ri-result-empty", () => {
    renderRi({
      config: { ...baseConfig, ideas: [] },
      state: { ratings: [], revealed: true },
    });
    expect(screen.getByTestId("ri-result-empty")).toBeInTheDocument();
  });
});
