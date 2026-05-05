import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SilentDebate, {
  SilentDebateConfig,
  SilentDebateState,
  DebateArgument,
} from "../SilentDebate";

const baseConfig: SilentDebateConfig = {
  title: "靜默辯論測試",
  topic: "科技讓人更孤獨嗎？",
  proLabel: "正方",
  conLabel: "反方",
  maxLength: 100,
};

const emptyState: SilentDebateState = { arguments: [], revealed: false };

const args: DebateArgument[] = [
  {
    argId: "a1",
    userId: "u1",
    userName: "Alice",
    side: "pro",
    text: "科技讓人更疏遠",
    hearts: ["u2"],
  },
  {
    argId: "a2",
    userId: "u2",
    userName: "Bob",
    side: "con",
    text: "科技讓人更連結",
    hearts: [],
  },
];

const revealedState: SilentDebateState = { arguments: args, revealed: true };

function renderSd(overrides: Partial<Parameters<typeof SilentDebate>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u3",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<SilentDebate {...props} />), props };
}

describe("SilentDebate — 基本渲染", () => {
  it("顯示標題", () => {
    renderSd();
    expect(screen.getByTestId("sd-title")).toHaveTextContent("靜默辯論測試");
  });

  it("顯示主題", () => {
    renderSd();
    expect(screen.getByTestId("sd-topic")).toHaveTextContent("科技讓人更孤獨嗎？");
  });

  it("未公布前顯示人數計數器", () => {
    renderSd({ state: { arguments: args, revealed: false } });
    expect(screen.getByTestId("sd-count")).toHaveTextContent("2");
  });

  it("顯示公布按鈕", () => {
    renderSd();
    expect(screen.getByTestId("sd-reveal-btn")).toBeInTheDocument();
  });
});

describe("SilentDebate — 提交前互動", () => {
  it("顯示正方和反方選擇按鈕", () => {
    renderSd();
    expect(screen.getByTestId("sd-side-pro")).toBeInTheDocument();
    expect(screen.getByTestId("sd-side-con")).toBeInTheDocument();
  });

  it("選擇正方後顯示文字輸入區", () => {
    renderSd();
    fireEvent.click(screen.getByTestId("sd-side-pro"));
    expect(screen.getByTestId("sd-text-input")).toBeInTheDocument();
  });

  it("選擇反方後顯示文字輸入區", () => {
    renderSd();
    fireEvent.click(screen.getByTestId("sd-side-con"));
    expect(screen.getByTestId("sd-text-input")).toBeInTheDocument();
  });

  it("沒有輸入內容時送出鈕 disabled", () => {
    renderSd();
    fireEvent.click(screen.getByTestId("sd-side-pro"));
    expect(screen.getByTestId("sd-submit-btn")).toBeDisabled();
  });

  it("有輸入內容時送出鈕可點", () => {
    renderSd();
    fireEvent.click(screen.getByTestId("sd-side-pro"));
    fireEvent.change(screen.getByTestId("sd-text-input"), {
      target: { value: "我的論點" },
    });
    expect(screen.getByTestId("sd-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 並帶正確 side", () => {
    const onSubmit = vi.fn();
    renderSd({ onSubmit });
    fireEvent.click(screen.getByTestId("sd-side-pro"));
    fireEvent.change(screen.getByTestId("sd-text-input"), {
      target: { value: "測試論點" },
    });
    fireEvent.click(screen.getByTestId("sd-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("pro", "測試論點");
  });

  it("點送出呼叫 onSubmit 反方", () => {
    const onSubmit = vi.fn();
    renderSd({ onSubmit });
    fireEvent.click(screen.getByTestId("sd-side-con"));
    fireEvent.change(screen.getByTestId("sd-text-input"), {
      target: { value: "反方論點" },
    });
    fireEvent.click(screen.getByTestId("sd-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("con", "反方論點");
  });

  it("已送出時顯示 sd-submitted", () => {
    renderSd({
      state: { arguments: [args[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("sd-submitted")).toBeInTheDocument();
  });

  it("點公布按鈕呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderSd({ onReveal });
    fireEvent.click(screen.getByTestId("sd-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});

describe("SilentDebate — 公布後顯示", () => {
  it("公布後顯示所有論點", () => {
    renderSd({ state: revealedState });
    expect(screen.getByTestId("sd-arg-a1")).toBeInTheDocument();
    expect(screen.getByTestId("sd-arg-a2")).toBeInTheDocument();
  });

  it("公布後顯示愛心按鈕", () => {
    renderSd({ state: revealedState });
    expect(screen.getByTestId("sd-heart-a1")).toBeInTheDocument();
    expect(screen.getByTestId("sd-heart-a2")).toBeInTheDocument();
  });

  it("點愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderSd({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("sd-heart-a2"));
    expect(onHeart).toHaveBeenCalledWith("a2");
  });

  it("顯示愛心數量", () => {
    renderSd({ state: revealedState });
    const heartBtn = screen.getByTestId("sd-heart-a1");
    expect(heartBtn).toHaveTextContent("1");
  });

  it("無論點時顯示 sd-empty", () => {
    renderSd({ state: { arguments: [], revealed: true } });
    expect(screen.getByTestId("sd-empty")).toBeInTheDocument();
  });

  it("公布後不再顯示提交表單", () => {
    renderSd({ state: revealedState, myUserId: "u3" });
    expect(screen.queryByTestId("sd-side-pro")).not.toBeInTheDocument();
  });
});
