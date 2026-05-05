import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IdeaMarket, {
  IdeaMarketConfig,
  IdeaMarketState,
  MarketIdea,
} from "../IdeaMarket";

const baseConfig: IdeaMarketConfig = {
  title: "創意市集",
  prompt: "用一句話說出你的創意點子",
  tokenBudget: 5,
  maxIdeaLength: 50,
  showAuthor: true,
};

const pitchState: IdeaMarketState = {
  ideas: [],
  allocations: [],
  phase: "pitch",
};

const ideas: MarketIdea[] = [
  {
    ideaId: "i1",
    userId: "u2",
    userName: "Bob",
    text: "建立共享廚房網絡",
  },
  {
    ideaId: "i2",
    userId: "u3",
    userName: "Carol",
    text: "社區菜園平台",
  },
];

const investState: IdeaMarketState = {
  ideas,
  allocations: [
    { investorId: "u1", ideaId: "i1", tokens: 2 },
    { investorId: "u4", ideaId: "i1", tokens: 3 },
    { investorId: "u4", ideaId: "i2", tokens: 1 },
  ],
  phase: "invest",
};

const resultState: IdeaMarketState = {
  ideas,
  allocations: [
    { investorId: "u1", ideaId: "i1", tokens: 3 },
    { investorId: "u4", ideaId: "i2", tokens: 4 },
  ],
  phase: "result",
};

function renderIm(
  overrides: Partial<Parameters<typeof IdeaMarket>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: pitchState,
    myUserId: "u1",
    onSubmitIdea: vi.fn(),
    onInvest: vi.fn(),
    onAdvancePhase: vi.fn(),
    ...overrides,
  };
  return { ...render(<IdeaMarket {...props} />), props };
}

describe("IdeaMarket — 基本渲染", () => {
  it("顯示標題", () => {
    renderIm();
    expect(screen.getByTestId("im-title")).toHaveTextContent(
      "創意市集"
    );
  });

  it("顯示提案階段", () => {
    renderIm();
    expect(screen.getByTestId("im-phase")).toHaveTextContent("提案");
  });

  it("顯示提示語", () => {
    renderIm();
    expect(screen.getByTestId("im-prompt")).toHaveTextContent(
      "用一句話說出你的創意點子"
    );
  });
});

describe("IdeaMarket — 提案階段", () => {
  it("顯示輸入框", () => {
    renderIm();
    expect(screen.getByTestId("im-pitch-input")).toBeInTheDocument();
  });

  it("空白時送出鈕 disabled", () => {
    renderIm();
    expect(screen.getByTestId("im-pitch-submit")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderIm();
    fireEvent.change(screen.getByTestId("im-pitch-input"), {
      target: { value: "共享工具圖書館" },
    });
    expect(
      screen.getByTestId("im-pitch-submit")
    ).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmitIdea", () => {
    const onSubmitIdea = vi.fn();
    renderIm({ onSubmitIdea });
    fireEvent.change(screen.getByTestId("im-pitch-input"), {
      target: { value: "共享工具圖書館" },
    });
    fireEvent.click(screen.getByTestId("im-pitch-submit"));
    expect(onSubmitIdea).toHaveBeenCalledWith("共享工具圖書館");
  });

  it("已送出後顯示確認訊息", () => {
    renderIm({
      state: {
        ideas: [
          {
            ideaId: "i99",
            userId: "u1",
            userName: "Alice",
            text: "我的點子",
          },
        ],
        allocations: [],
        phase: "pitch",
      },
    });
    expect(screen.getByTestId("im-submitted-msg")).toBeInTheDocument();
  });

  it("顯示提案數量", () => {
    renderIm();
    expect(screen.getByTestId("im-pitch-count")).toBeInTheDocument();
  });

  it("點進入投資呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderIm({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("im-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("IdeaMarket — 投資階段", () => {
  it("顯示投資階段", () => {
    renderIm({ state: investState });
    expect(screen.getByTestId("im-phase")).toHaveTextContent("投資");
  });

  it("顯示剩餘代幣", () => {
    renderIm({ state: investState });
    expect(
      screen.getByTestId("im-budget-remaining")
    ).toHaveTextContent("3");
  });

  it("顯示他人的點子", () => {
    renderIm({ state: investState });
    expect(screen.getByTestId("im-idea-i1")).toBeInTheDocument();
    expect(screen.getByTestId("im-idea-i2")).toBeInTheDocument();
  });

  it("顯示已投入的代幣數", () => {
    renderIm({ state: investState });
    expect(screen.getByTestId("im-tokens-i1")).toHaveTextContent(
      "2"
    );
  });

  it("點加呼叫 onInvest +1", () => {
    const onInvest = vi.fn();
    renderIm({ state: investState, onInvest });
    fireEvent.click(screen.getByTestId("im-invest-i2"));
    expect(onInvest).toHaveBeenCalledWith("i2", 1);
  });

  it("點減呼叫 onInvest -1", () => {
    const onInvest = vi.fn();
    renderIm({ state: investState, onInvest });
    fireEvent.click(screen.getByTestId("im-disinvest-i1"));
    expect(onInvest).toHaveBeenCalledWith("i1", -1);
  });

  it("減按鈕在 0 代幣時 disabled", () => {
    renderIm({ state: investState });
    expect(screen.getByTestId("im-disinvest-i2")).toBeDisabled();
  });

  it("點揭曉結果呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderIm({ state: investState, onAdvancePhase });
    fireEvent.click(screen.getByTestId("im-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("IdeaMarket — 結果階段", () => {
  it("顯示結果階段", () => {
    renderIm({ state: resultState });
    expect(screen.getByTestId("im-phase")).toHaveTextContent("結果");
  });

  it("顯示所有點子結果", () => {
    renderIm({ state: resultState });
    expect(screen.getByTestId("im-result-i1")).toBeInTheDocument();
    expect(screen.getByTestId("im-result-i2")).toBeInTheDocument();
  });

  it("顯示代幣總數", () => {
    renderIm({ state: resultState });
    expect(
      screen.getByTestId("im-total-tokens-i1")
    ).toHaveTextContent("3");
  });

  it("最高票點子顯示 im-winner", () => {
    renderIm({ state: resultState });
    expect(screen.getByTestId("im-winner")).toBeInTheDocument();
  });

  it("無提案時顯示 im-empty", () => {
    renderIm({
      state: { ideas: [], allocations: [], phase: "result" },
    });
    expect(screen.getByTestId("im-empty")).toBeInTheDocument();
  });
});
