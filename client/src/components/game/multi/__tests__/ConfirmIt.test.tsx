import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmIt, {
  ConfirmItConfig,
  ConfirmItState,
  ConfirmResponse,
} from "../ConfirmIt";

const baseConfig: ConfirmItConfig = {
  title: "信心投票測試",
  statement: "地球繞太陽轉",
  showConfidence: true,
};

const emptyState: ConfirmItState = { responses: [], revealed: false };

const responses: ConfirmResponse[] = [
  { respId: "r1", userId: "u1", userName: "Alice", answer: "true", confidence: 90 },
  { respId: "r2", userId: "u2", userName: "Bob", answer: "true", confidence: 80 },
  { respId: "r3", userId: "u3", userName: "Carol", answer: "false", confidence: 60 },
];

const revealedState: ConfirmItState = { responses, revealed: true };

function renderCi(overrides: Partial<Parameters<typeof ConfirmIt>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<ConfirmIt {...props} />), props };
}

describe("ConfirmIt — 基本渲染", () => {
  it("顯示標題", () => {
    renderCi();
    expect(screen.getByTestId("ci-title")).toHaveTextContent("信心投票測試");
  });

  it("顯示陳述句", () => {
    renderCi();
    expect(screen.getByTestId("ci-statement")).toHaveTextContent("地球繞太陽轉");
  });

  it("顯示正確和錯誤按鈕", () => {
    renderCi();
    expect(screen.getByTestId("ci-answer-true")).toBeInTheDocument();
    expect(screen.getByTestId("ci-answer-false")).toBeInTheDocument();
  });

  it("顯示投票人數", () => {
    renderCi();
    expect(screen.getByTestId("ci-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderCi();
    expect(screen.getByTestId("ci-reveal-btn")).toBeInTheDocument();
  });
});

describe("ConfirmIt — 投票互動", () => {
  it("選擇正確後顯示信心程度選項", () => {
    renderCi();
    fireEvent.click(screen.getByTestId("ci-answer-true"));
    expect(screen.getByTestId("ci-conf-70")).toBeInTheDocument();
    expect(screen.getByTestId("ci-conf-100")).toBeInTheDocument();
  });

  it("選擇錯誤後顯示信心程度選項", () => {
    renderCi();
    fireEvent.click(screen.getByTestId("ci-answer-false"));
    expect(screen.getByTestId("ci-conf-50")).toBeInTheDocument();
  });

  it("選擇後顯示送出鈕", () => {
    renderCi();
    fireEvent.click(screen.getByTestId("ci-answer-true"));
    expect(screen.getByTestId("ci-submit-btn")).toBeInTheDocument();
  });

  it("點送出呼叫 onSubmit 帶正確答案和信心", () => {
    const onSubmit = vi.fn();
    renderCi({ onSubmit });
    fireEvent.click(screen.getByTestId("ci-answer-true"));
    fireEvent.click(screen.getByTestId("ci-conf-80"));
    fireEvent.click(screen.getByTestId("ci-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("true", 80);
  });

  it("點送出 false 呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderCi({ onSubmit });
    fireEvent.click(screen.getByTestId("ci-answer-false"));
    fireEvent.click(screen.getByTestId("ci-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("false", 70);
  });

  it("已投票後顯示 ci-submitted", () => {
    renderCi({
      state: { responses: [responses[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("ci-submitted")).toBeInTheDocument();
  });

  it("已投票後顯示答案", () => {
    renderCi({
      state: { responses: [responses[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("ci-submitted")).toHaveTextContent("正確");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderCi({ onReveal });
    fireEvent.click(screen.getByTestId("ci-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("showConfidence=false 不顯示信心程度", () => {
    renderCi({ config: { ...baseConfig, showConfidence: false } });
    fireEvent.click(screen.getByTestId("ci-answer-true"));
    expect(screen.queryByTestId("ci-conf-70")).not.toBeInTheDocument();
  });
});

describe("ConfirmIt — 公布後顯示", () => {
  it("公布後顯示 ci-result", () => {
    renderCi({ state: revealedState });
    expect(screen.getByTestId("ci-result")).toBeInTheDocument();
  });

  it("顯示正確票數（2）", () => {
    renderCi({ state: revealedState });
    expect(screen.getByTestId("ci-true-count")).toHaveTextContent("2");
  });

  it("顯示錯誤票數（1）", () => {
    renderCi({ state: revealedState });
    expect(screen.getByTestId("ci-false-count")).toHaveTextContent("1");
  });

  it("顯示正確方平均信心", () => {
    renderCi({ state: revealedState });
    expect(screen.getByTestId("ci-true-conf")).toHaveTextContent("85%");
  });

  it("顯示每個人的回應", () => {
    renderCi({ state: revealedState });
    expect(screen.getByTestId("ci-resp-r1")).toBeInTheDocument();
    expect(screen.getByTestId("ci-resp-r2")).toBeInTheDocument();
    expect(screen.getByTestId("ci-resp-r3")).toBeInTheDocument();
  });

  it("無投票時顯示 ci-empty", () => {
    renderCi({ state: { responses: [], revealed: true } });
    expect(screen.getByTestId("ci-empty")).toBeInTheDocument();
  });

  it("公布後不顯示投票按鈕", () => {
    renderCi({ state: revealedState });
    expect(screen.queryByTestId("ci-answer-true")).not.toBeInTheDocument();
  });
});
