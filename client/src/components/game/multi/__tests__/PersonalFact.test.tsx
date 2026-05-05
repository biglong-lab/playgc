import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PersonalFact, {
  PersonalFactConfig,
  PersonalFactState,
  FactEntry,
} from "../PersonalFact";

const baseConfig: PersonalFactConfig = {
  title: "趣味自我揭秘",
  prompt: "說一個關於你自己、讓大家驚訝的小事",
  maxLength: 50,
  showAuthor: true,
};

const emptyState: PersonalFactState = { facts: [], revealed: false };

const facts: FactEntry[] = [
  {
    factId: "f1",
    userId: "u2",
    userName: "Bob",
    text: "我曾和一位諾貝爾獎得主共進午餐",
    hearts: ["u1", "u3"],
  },
  {
    factId: "f2",
    userId: "u3",
    userName: "Carol",
    text: "我會說 5 種語言",
    hearts: [],
  },
];

const revealedState: PersonalFactState = { facts, revealed: true };

function renderPf(
  overrides: Partial<Parameters<typeof PersonalFact>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<PersonalFact {...props} />), props };
}

describe("PersonalFact — 基本渲染", () => {
  it("顯示標題", () => {
    renderPf();
    expect(screen.getByTestId("pf-title")).toHaveTextContent(
      "趣味自我揭秘"
    );
  });

  it("顯示提示語", () => {
    renderPf();
    expect(screen.getByTestId("pf-prompt")).toBeInTheDocument();
  });

  it("顯示送出數量", () => {
    renderPf();
    expect(screen.getByTestId("pf-count")).toBeInTheDocument();
  });
});

describe("PersonalFact — 送出事實", () => {
  it("顯示輸入框", () => {
    renderPf();
    expect(screen.getByTestId("pf-input")).toBeInTheDocument();
  });

  it("空白時送出鈕 disabled", () => {
    renderPf();
    expect(screen.getByTestId("pf-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderPf();
    fireEvent.change(screen.getByTestId("pf-input"), {
      target: { value: "我會倒立走路" },
    });
    expect(
      screen.getByTestId("pf-submit-btn")
    ).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderPf({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("pf-input"), {
      target: { value: "超過五個字的趣味事實啦啦啦" },
    });
    expect(
      screen.getByTestId("pf-char-error")
    ).toBeInTheDocument();
  });

  it("超過 maxLength 送出鈕 disabled", () => {
    renderPf({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("pf-input"), {
      target: { value: "超過五個字的趣味事實啦啦啦" },
    });
    expect(screen.getByTestId("pf-submit-btn")).toBeDisabled();
  });

  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderPf({ onSubmit });
    fireEvent.change(screen.getByTestId("pf-input"), {
      target: { value: "我養了一隻迷你豬" },
    });
    fireEvent.click(screen.getByTestId("pf-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("我養了一隻迷你豬");
  });

  it("已送出後顯示確認訊息", () => {
    renderPf({
      state: {
        facts: [
          {
            factId: "f99",
            userId: "u1",
            userName: "Alice",
            text: "我的事實",
            hearts: [],
          },
        ],
        revealed: false,
      },
    });
    expect(
      screen.getByTestId("pf-submitted-msg")
    ).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderPf();
    expect(
      screen.getByTestId("pf-reveal-btn")
    ).toBeInTheDocument();
  });

  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderPf({ onReveal });
    fireEvent.click(screen.getByTestId("pf-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已揭曉後不顯示揭曉按鈕", () => {
    renderPf({ state: revealedState });
    expect(
      screen.queryByTestId("pf-reveal-btn")
    ).not.toBeInTheDocument();
  });
});

describe("PersonalFact — 揭曉結果", () => {
  it("顯示所有事實", () => {
    renderPf({ state: revealedState });
    expect(screen.getByTestId("pf-fact-f1")).toBeInTheDocument();
    expect(screen.getByTestId("pf-fact-f2")).toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderPf({ state: revealedState });
    expect(screen.getByTestId("pf-author-f1")).toHaveTextContent(
      "Bob"
    );
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderPf({
      config: { ...baseConfig, showAuthor: false },
      state: revealedState,
    });
    expect(
      screen.queryByTestId("pf-author-f1")
    ).not.toBeInTheDocument();
  });

  it("顯示愛心按鈕", () => {
    renderPf({ state: revealedState });
    expect(
      screen.getByTestId("pf-heart-f1")
    ).toBeInTheDocument();
  });

  it("顯示愛心數量", () => {
    renderPf({ state: revealedState });
    expect(
      screen.getByTestId("pf-heart-count-f1")
    ).toHaveTextContent("2");
  });

  it("點愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderPf({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("pf-heart-f2"));
    expect(onHeart).toHaveBeenCalledWith("f2");
  });

  it("自己的事實愛心 disabled", () => {
    renderPf({
      state: {
        facts: [
          {
            factId: "f99",
            userId: "u1",
            userName: "Alice",
            text: "我的事實",
            hearts: [],
          },
        ],
        revealed: true,
      },
    });
    expect(screen.getByTestId("pf-heart-f99")).toBeDisabled();
  });

  it("無事實時顯示 pf-empty", () => {
    renderPf({ state: { facts: [], revealed: true } });
    expect(screen.getByTestId("pf-empty")).toBeInTheDocument();
  });
});
