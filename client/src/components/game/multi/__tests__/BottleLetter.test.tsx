import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BottleLetter, {
  type BottleLetterConfig,
  type BottleLetterState,
} from "../BottleLetter";

const config: BottleLetterConfig = {
  title: "漂流瓶",
  prompt: "寫下一句話",
  maxLength: 200,
  showAuthor: true,
};

const emptyState: BottleLetterState = { letters: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderBL(overrides = {}) {
  return render(<BottleLetter {...baseProps} {...overrides} />);
}

describe("BottleLetter — 基本渲染", () => {
  it("顯示標題", () => {
    renderBL();
    expect(screen.getByTestId("bl-title")).toHaveTextContent("漂流瓶");
  });

  it("顯示提示文字", () => {
    renderBL();
    expect(screen.getByTestId("bl-prompt")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderBL();
    expect(screen.getByTestId("bl-input")).toBeInTheDocument();
  });

  it("顯示已投入封數 0", () => {
    renderBL();
    expect(screen.getByTestId("bl-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderBL();
    expect(screen.getByTestId("bl-reveal-btn")).toBeInTheDocument();
  });
});

describe("BottleLetter — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderBL({ draftText: "" });
    expect(screen.getByTestId("bl-submit-btn")).toBeDisabled();
  });

  it("有內容時可以送出", () => {
    renderBL({ draftText: "今天天氣真好" });
    expect(screen.getByTestId("bl-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderBL({ draftText: "今天天氣真好", onSubmit });
    fireEvent.click(screen.getByTestId("bl-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderBL({ onDraftChange });
    fireEvent.change(screen.getByTestId("bl-input"), { target: { value: "海風吹來" } });
    expect(onDraftChange).toHaveBeenCalledWith("海風吹來");
  });
});

describe("BottleLetter — 已送出狀態", () => {
  const stateWithMyLetter: BottleLetterState = {
    letters: [
      { letterId: "l1", userId: "u1", userName: "Alice", text: "希望找到幸運" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderBL({ state: stateWithMyLetter });
    expect(screen.getByTestId("bl-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入框", () => {
    renderBL({ state: stateWithMyLetter });
    expect(screen.queryByTestId("bl-input")).not.toBeInTheDocument();
  });

  it("已送出顯示 1 封信已投入", () => {
    renderBL({ state: stateWithMyLetter });
    expect(screen.getByTestId("bl-count")).toHaveTextContent("1");
  });
});

describe("BottleLetter — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderBL({ onReveal });
    fireEvent.click(screen.getByTestId("bl-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: BottleLetterState = { letters: [], revealed: true };

  it("揭曉空白顯示 bl-empty", () => {
    renderBL({ state: revealedEmpty });
    expect(screen.getByTestId("bl-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderBL({ state: revealedEmpty });
    expect(screen.queryByTestId("bl-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWith2: BottleLetterState = {
    letters: [
      { letterId: "l1", userId: "u1", userName: "Alice", text: "願你一路平安" },
      { letterId: "l2", userId: "u2", userName: "Bob", text: "世界很大要多看看" },
    ],
    revealed: true,
  };

  it("顯示 bl-result 容器", () => {
    renderBL({ state: revealedWith2 });
    expect(screen.getByTestId("bl-result")).toBeInTheDocument();
  });

  it("顯示第一封信", () => {
    renderBL({ state: revealedWith2 });
    expect(screen.getByTestId("bl-letter-l1")).toBeInTheDocument();
  });

  it("顯示第二封信", () => {
    renderBL({ state: revealedWith2 });
    expect(screen.getByTestId("bl-letter-l2")).toBeInTheDocument();
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderBL({ state: revealedWith2 });
    expect(screen.getByTestId("bl-author-l1")).toHaveTextContent("Alice");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderBL({
      state: revealedWith2,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("bl-author-l1")).not.toBeInTheDocument();
  });

  it("信件文字正確顯示", () => {
    renderBL({ state: revealedWith2 });
    expect(screen.getByTestId("bl-letter-l1")).toHaveTextContent("願你一路平安");
  });
});
