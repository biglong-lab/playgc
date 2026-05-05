import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FreezeFrame, {
  FreezeFrameConfig,
  FreezeFrameState,
  FrameEntry,
} from "../FreezeFrame";

const baseConfig: FreezeFrameConfig = {
  title: "現況快照測試",
  prompt: "你現在在做什麼？",
  maxLength: 80,
};

const emptyState: FreezeFrameState = { frames: [], revealed: false };

const frames: FrameEntry[] = [
  { frameId: "f1", userId: "u1", userName: "Alice", text: "開發新功能", status: "green" },
  { frameId: "f2", userId: "u2", userName: "Bob", text: "卡在一個 bug", status: "yellow" },
  { frameId: "f3", userId: "u3", userName: "Carol", text: "需要幫忙部署", status: "red" },
];

const revealedState: FreezeFrameState = { frames, revealed: true };

function renderFf(overrides: Partial<Parameters<typeof FreezeFrame>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<FreezeFrame {...props} />), props };
}

describe("FreezeFrame — 基本渲染", () => {
  it("顯示標題", () => {
    renderFf();
    expect(screen.getByTestId("ff-title")).toHaveTextContent("現況快照測試");
  });

  it("顯示 prompt", () => {
    renderFf();
    expect(screen.getByTestId("ff-prompt")).toHaveTextContent("你現在在做什麼？");
  });

  it("顯示三個狀態按鈕", () => {
    renderFf();
    expect(screen.getByTestId("ff-status-green")).toBeInTheDocument();
    expect(screen.getByTestId("ff-status-yellow")).toBeInTheDocument();
    expect(screen.getByTestId("ff-status-red")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderFf();
    expect(screen.getByTestId("ff-input")).toBeInTheDocument();
  });

  it("顯示已回報人數 0", () => {
    renderFf();
    expect(screen.getByTestId("ff-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderFf();
    expect(screen.getByTestId("ff-reveal-btn")).toBeInTheDocument();
  });
});

describe("FreezeFrame — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderFf();
    expect(screen.getByTestId("ff-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderFf();
    fireEvent.change(screen.getByTestId("ff-input"), {
      target: { value: "開發新功能" },
    });
    expect(screen.getByTestId("ff-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶文字和預設狀態 green", () => {
    const onSubmit = vi.fn();
    renderFf({ onSubmit });
    fireEvent.change(screen.getByTestId("ff-input"), {
      target: { value: "進行中" },
    });
    fireEvent.click(screen.getByTestId("ff-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("進行中", "green");
  });

  it("選擇 yellow 再送出帶 yellow", () => {
    const onSubmit = vi.fn();
    renderFf({ onSubmit });
    fireEvent.click(screen.getByTestId("ff-status-yellow"));
    fireEvent.change(screen.getByTestId("ff-input"), {
      target: { value: "有阻礙" },
    });
    fireEvent.click(screen.getByTestId("ff-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("有阻礙", "yellow");
  });

  it("選擇 red 再送出帶 red", () => {
    const onSubmit = vi.fn();
    renderFf({ onSubmit });
    fireEvent.click(screen.getByTestId("ff-status-red"));
    fireEvent.change(screen.getByTestId("ff-input"), {
      target: { value: "卡住了" },
    });
    fireEvent.click(screen.getByTestId("ff-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("卡住了", "red");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderFf({ onReveal });
    fireEvent.click(screen.getByTestId("ff-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 ff-my-frame", () => {
    const myFrame: FrameEntry = {
      frameId: "f99",
      userId: "u4",
      userName: "David",
      text: "正在寫測試",
      status: "green",
    };
    renderFf({
      state: { frames: [myFrame], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("ff-my-frame")).toHaveTextContent("正在寫測試");
  });

  it("已提交者不顯示輸入框", () => {
    const myFrame: FrameEntry = {
      frameId: "f99",
      userId: "u4",
      userName: "David",
      text: "完成",
      status: "green",
    };
    renderFf({
      state: { frames: [myFrame], revealed: false },
      myUserId: "u4",
    });
    expect(screen.queryByTestId("ff-input")).not.toBeInTheDocument();
  });

  it("已有 3 人回報顯示人數 3", () => {
    renderFf({ state: { frames, revealed: false } });
    expect(screen.getByTestId("ff-count")).toHaveTextContent("3");
  });
});

describe("FreezeFrame — 公布結果", () => {
  it("公布後顯示 ff-result", () => {
    renderFf({ state: revealedState });
    expect(screen.getByTestId("ff-result")).toBeInTheDocument();
  });

  it("公布後顯示各狀態群組", () => {
    renderFf({ state: revealedState });
    expect(screen.getByTestId("ff-group-green")).toBeInTheDocument();
    expect(screen.getByTestId("ff-group-yellow")).toBeInTheDocument();
    expect(screen.getByTestId("ff-group-red")).toBeInTheDocument();
  });

  it("顯示每個人的框架", () => {
    renderFf({ state: revealedState });
    expect(screen.getByTestId("ff-frame-f1")).toHaveTextContent("開發新功能");
    expect(screen.getByTestId("ff-frame-f2")).toHaveTextContent("卡在一個 bug");
    expect(screen.getByTestId("ff-frame-f3")).toHaveTextContent("需要幫忙部署");
  });

  it("無人回報顯示 ff-empty", () => {
    renderFf({ state: { frames: [], revealed: true } });
    expect(screen.getByTestId("ff-empty")).toBeInTheDocument();
  });
});
