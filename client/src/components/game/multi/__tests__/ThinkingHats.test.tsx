import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThinkingHats, {
  type ThinkingHatsConfig,
  type ThinkingHatsState,
  DEFAULT_HATS,
} from "../ThinkingHats";

const config: ThinkingHatsConfig = {
  title: "六頂思考帽",
  topic: "今天的課程",
  hats: DEFAULT_HATS,
  maxLength: 100,
  showAuthor: true,
};

const emptyState: ThinkingHatsState = { thoughts: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  selectedHatId: null,
  draftText: "",
  onSelectHat: vi.fn(),
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderTH(overrides = {}) {
  return render(<ThinkingHats {...baseProps} {...overrides} />);
}

describe("ThinkingHats — 基本渲染", () => {
  it("顯示標題", () => {
    renderTH();
    expect(screen.getByTestId("th-title")).toHaveTextContent("六頂思考帽");
  });

  it("顯示主題", () => {
    renderTH();
    expect(screen.getByTestId("th-topic")).toHaveTextContent("今天的課程");
  });

  it("顯示 6 頂帽子", () => {
    renderTH();
    expect(screen.getByTestId("th-hat-white")).toBeInTheDocument();
    expect(screen.getByTestId("th-hat-red")).toBeInTheDocument();
    expect(screen.getByTestId("th-hat-black")).toBeInTheDocument();
    expect(screen.getByTestId("th-hat-yellow")).toBeInTheDocument();
    expect(screen.getByTestId("th-hat-green")).toBeInTheDocument();
    expect(screen.getByTestId("th-hat-blue")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderTH();
    expect(screen.getByTestId("th-reveal-btn")).toBeInTheDocument();
  });

  it("顯示已送出數量 0", () => {
    renderTH();
    expect(screen.getByTestId("th-count")).toHaveTextContent("0");
  });
});

describe("ThinkingHats — 帽子選擇", () => {
  it("點帽子觸發 onSelectHat", () => {
    const onSelectHat = vi.fn();
    renderTH({ onSelectHat });
    fireEvent.click(screen.getByTestId("th-hat-red"));
    expect(onSelectHat).toHaveBeenCalledWith("red");
  });

  it("未選帽子時不顯示輸入框", () => {
    renderTH({ selectedHatId: null });
    expect(screen.queryByTestId("th-input")).not.toBeInTheDocument();
  });

  it("選了帽子後顯示輸入框", () => {
    renderTH({ selectedHatId: "white" });
    expect(screen.getByTestId("th-input")).toBeInTheDocument();
  });
});

describe("ThinkingHats — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderTH({ selectedHatId: "white", draftText: "" });
    expect(screen.getByTestId("th-submit-btn")).toBeDisabled();
  });

  it("有文字時送出按鈕可點", () => {
    renderTH({ selectedHatId: "green", draftText: "創新想法" });
    expect(screen.getByTestId("th-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderTH({ selectedHatId: "green", draftText: "創新想法", onSubmit });
    fireEvent.click(screen.getByTestId("th-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderTH({ selectedHatId: "white", onDraftChange });
    fireEvent.change(screen.getByTestId("th-input"), { target: { value: "數據" } });
    expect(onDraftChange).toHaveBeenCalledWith("數據");
  });

  it("顯示剩餘字數", () => {
    renderTH({ selectedHatId: "white", draftText: "測試" });
    expect(screen.getByTestId("th-chars-left")).toHaveTextContent("98");
  });
});

describe("ThinkingHats — 已送出狀態", () => {
  const stateWithMyThought: ThinkingHatsState = {
    thoughts: [
      { thoughtId: "t1", userId: "u1", userName: "Alice", hatId: "yellow", text: "這很有意義" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderTH({ state: stateWithMyThought });
    expect(screen.getByTestId("th-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏帽子選擇", () => {
    renderTH({ state: stateWithMyThought });
    expect(screen.queryByTestId("th-hat-white")).not.toBeInTheDocument();
  });
});

describe("ThinkingHats — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderTH({ onReveal });
    fireEvent.click(screen.getByTestId("th-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: ThinkingHatsState = { thoughts: [], revealed: true };

  it("揭曉空白顯示 th-empty", () => {
    renderTH({ state: revealedEmpty });
    expect(screen.getByTestId("th-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderTH({ state: revealedEmpty });
    expect(screen.queryByTestId("th-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithThoughts: ThinkingHatsState = {
    thoughts: [
      { thoughtId: "t1", userId: "u2", userName: "Bob", hatId: "black", text: "有些風險" },
      { thoughtId: "t2", userId: "u3", userName: "Carol", hatId: "black", text: "需要謹慎" },
    ],
    revealed: true,
  };

  it("顯示 th-results 容器", () => {
    renderTH({ state: revealedWithThoughts });
    expect(screen.getByTestId("th-results")).toBeInTheDocument();
  });

  it("按帽子分組顯示", () => {
    renderTH({ state: revealedWithThoughts });
    expect(screen.getByTestId("th-group-black")).toBeInTheDocument();
  });

  it("顯示思考卡", () => {
    renderTH({ state: revealedWithThoughts });
    expect(screen.getByTestId("th-thought-t1")).toBeInTheDocument();
    expect(screen.getByTestId("th-thought-t2")).toBeInTheDocument();
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderTH({ state: revealedWithThoughts });
    expect(screen.getByTestId("th-author-t1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderTH({
      state: revealedWithThoughts,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("th-author-t1")).not.toBeInTheDocument();
  });

  it("顯示思考文字", () => {
    renderTH({ state: revealedWithThoughts });
    expect(screen.getByTestId("th-text-t1")).toHaveTextContent("有些風險");
  });
});
