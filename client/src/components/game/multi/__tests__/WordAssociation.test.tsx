import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordAssociation, {
  type WordAssociationConfig,
  type WordAssociationState,
} from "../WordAssociation";

const config: WordAssociationConfig = {
  title: "自由聯想",
  words: ["海邊", "旅行"],
  maxResponseLength: 20,
  showAuthor: true,
};

const initialState: WordAssociationState = {
  responses: [],
  currentWordIndex: 0,
  revealedUpTo: 0,
};

const baseProps = {
  config,
  state: initialState,
  myUserId: "u1",
  draftResponse: "",
  onDraftChange: vi.fn(),
  onSubmitResponse: vi.fn(),
  onReveal: vi.fn(),
  onNext: vi.fn(),
};

function renderWA(overrides = {}) {
  return render(<WordAssociation {...baseProps} {...overrides} />);
}

describe("WordAssociation — 基本渲染", () => {
  it("顯示標題", () => {
    renderWA();
    expect(screen.getByTestId("wa-title")).toHaveTextContent("自由聯想");
  });

  it("顯示第一個關鍵詞", () => {
    renderWA();
    expect(screen.getByTestId("wa-word")).toHaveTextContent("海邊");
  });

  it("顯示進度 1/2", () => {
    renderWA();
    expect(screen.getByTestId("wa-progress")).toHaveTextContent("第 1 / 2 詞");
  });

  it("顯示輸入框", () => {
    renderWA();
    expect(screen.getByTestId("wa-input")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderWA();
    expect(screen.getByTestId("wa-reveal-btn")).toBeInTheDocument();
  });
});

describe("WordAssociation — 輸入與送出", () => {
  it("空白時送出按鈕 disabled", () => {
    renderWA({ draftResponse: "" });
    expect(screen.getByTestId("wa-submit-btn")).toBeDisabled();
  });

  it("有文字時送出按鈕可點", () => {
    renderWA({ draftResponse: "沙灘" });
    expect(screen.getByTestId("wa-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmitResponse", () => {
    const onSubmitResponse = vi.fn();
    renderWA({ draftResponse: "沙灘", onSubmitResponse });
    fireEvent.click(screen.getByTestId("wa-submit-btn"));
    expect(onSubmitResponse).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderWA({ onDraftChange });
    fireEvent.change(screen.getByTestId("wa-input"), { target: { value: "海鷗" } });
    expect(onDraftChange).toHaveBeenCalledWith("海鷗");
  });

  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderWA({ onReveal });
    fireEvent.click(screen.getByTestId("wa-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });
});

describe("WordAssociation — 已回應狀態", () => {
  const stateWithMyResponse: WordAssociationState = {
    responses: [
      { responseId: "r1", userId: "u1", userName: "Alice", wordIndex: 0, response: "沙灘" },
    ],
    currentWordIndex: 0,
    revealedUpTo: 0,
  };

  it("已回應顯示確認訊息", () => {
    renderWA({ state: stateWithMyResponse });
    expect(screen.getByTestId("wa-responded-msg")).toBeInTheDocument();
  });

  it("已回應隱藏輸入框", () => {
    renderWA({ state: stateWithMyResponse });
    expect(screen.queryByTestId("wa-input")).not.toBeInTheDocument();
  });
});

describe("WordAssociation — 揭曉結果", () => {
  const revealedState: WordAssociationState = {
    responses: [
      { responseId: "r1", userId: "u1", userName: "Alice", wordIndex: 0, response: "沙灘" },
      { responseId: "r2", userId: "u2", userName: "Bob", wordIndex: 0, response: "沙灘" },
      { responseId: "r3", userId: "u3", userName: "Carol", wordIndex: 0, response: "夕陽" },
    ],
    currentWordIndex: 0,
    revealedUpTo: 1,
  };

  it("顯示揭曉結果區", () => {
    renderWA({ state: revealedState });
    expect(screen.getByTestId("wa-result")).toBeInTheDocument();
  });

  it("顯示相同回應分組", () => {
    renderWA({ state: revealedState });
    expect(screen.getByTestId("wa-response-group-沙灘")).toBeInTheDocument();
  });

  it("顯示相同回應次數", () => {
    renderWA({ state: revealedState });
    expect(screen.getByTestId("wa-response-count-沙灘")).toHaveTextContent("×2");
  });

  it("顯示作者回應（showAuthor=true）", () => {
    renderWA({ state: revealedState });
    expect(screen.getByTestId("wa-author-response-r1")).toBeInTheDocument();
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderWA({
      state: revealedState,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("wa-author-response-r1")).not.toBeInTheDocument();
  });

  it("非最後一詞：顯示下一詞按鈕", () => {
    renderWA({ state: revealedState });
    expect(screen.getByTestId("wa-next-btn")).toBeInTheDocument();
  });

  it("最後一詞揭曉：顯示完成按鈕", () => {
    const lastWordRevealed: WordAssociationState = {
      responses: [
        { responseId: "r1", userId: "u1", userName: "Alice", wordIndex: 1, response: "飛機" },
      ],
      currentWordIndex: 1,
      revealedUpTo: 2,
    };
    renderWA({ state: lastWordRevealed });
    expect(screen.getByTestId("wa-finish-btn")).toBeInTheDocument();
  });

  it("點下一詞觸發 onNext", () => {
    const onNext = vi.fn();
    renderWA({ state: revealedState, onNext });
    fireEvent.click(screen.getByTestId("wa-next-btn"));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe("WordAssociation — 全部完成", () => {
  const completedState: WordAssociationState = {
    responses: [
      { responseId: "r1", userId: "u1", userName: "Alice", wordIndex: 0, response: "沙灘" },
      { responseId: "r2", userId: "u1", userName: "Alice", wordIndex: 1, response: "飛機" },
    ],
    currentWordIndex: 2,
    revealedUpTo: 2,
  };

  it("顯示 wa-complete", () => {
    renderWA({ state: completedState });
    expect(screen.getByTestId("wa-complete")).toBeInTheDocument();
  });

  it("完成後不顯示輸入框", () => {
    renderWA({ state: completedState });
    expect(screen.queryByTestId("wa-input")).not.toBeInTheDocument();
  });
});
