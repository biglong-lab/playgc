import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimeCapture, {
  type TimeCaptureConfig,
  type TimeCaptureState,
} from "../TimeCapture";

const config: TimeCaptureConfig = {
  title: "時空膠囊",
  prompt: "寫下給未來的話",
  openDate: "2030-01-01",
  maxLength: 200,
  showAuthor: true,
};

const emptyState: TimeCaptureState = { messages: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderTC(overrides = {}) {
  return render(<TimeCapture {...baseProps} {...overrides} />);
}

describe("TimeCapture — 基本渲染", () => {
  it("顯示標題", () => {
    renderTC();
    expect(screen.getByTestId("tc-title")).toHaveTextContent("時空膠囊");
  });

  it("顯示提示文字", () => {
    renderTC();
    expect(screen.getByTestId("tc-prompt")).toBeInTheDocument();
  });

  it("顯示開啟日期", () => {
    renderTC();
    expect(screen.getByTestId("tc-open-date")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderTC();
    expect(screen.getByTestId("tc-input")).toBeInTheDocument();
  });

  it("顯示已封存則數 0", () => {
    renderTC();
    expect(screen.getByTestId("tc-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderTC();
    expect(screen.getByTestId("tc-reveal-btn")).toBeInTheDocument();
  });
});

describe("TimeCapture — 無 openDate 設定", () => {
  it("沒有 openDate 時不顯示開啟日期區塊", () => {
    renderTC({ config: { ...config, openDate: undefined } });
    expect(screen.queryByTestId("tc-open-date")).not.toBeInTheDocument();
  });
});

describe("TimeCapture — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderTC({ draftText: "" });
    expect(screen.getByTestId("tc-submit-btn")).toBeDisabled();
  });

  it("有內容時可以送出", () => {
    renderTC({ draftText: "你好未來的我" });
    expect(screen.getByTestId("tc-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderTC({ draftText: "你好未來的我", onSubmit });
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderTC({ onDraftChange });
    fireEvent.change(screen.getByTestId("tc-input"), { target: { value: "希望一切都好" } });
    expect(onDraftChange).toHaveBeenCalledWith("希望一切都好");
  });
});

describe("TimeCapture — 已送出狀態", () => {
  const stateWithMyMsg: TimeCaptureState = {
    messages: [
      { msgId: "m1", userId: "u1", userName: "Alice", text: "加油！" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderTC({ state: stateWithMyMsg });
    expect(screen.getByTestId("tc-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入框", () => {
    renderTC({ state: stateWithMyMsg });
    expect(screen.queryByTestId("tc-input")).not.toBeInTheDocument();
  });

  it("已送出顯示 1 則已封存", () => {
    renderTC({ state: stateWithMyMsg });
    expect(screen.getByTestId("tc-count")).toHaveTextContent("1");
  });
});

describe("TimeCapture — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderTC({ onReveal });
    fireEvent.click(screen.getByTestId("tc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: TimeCaptureState = { messages: [], revealed: true };

  it("揭曉空白顯示 tc-empty", () => {
    renderTC({ state: revealedEmpty });
    expect(screen.getByTestId("tc-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderTC({ state: revealedEmpty });
    expect(screen.queryByTestId("tc-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWith2: TimeCaptureState = {
    messages: [
      { msgId: "m1", userId: "u1", userName: "Alice", text: "願你平安" },
      { msgId: "m2", userId: "u2", userName: "Bob", text: "繼續前行" },
    ],
    revealed: true,
  };

  it("顯示 tc-result 容器", () => {
    renderTC({ state: revealedWith2 });
    expect(screen.getByTestId("tc-result")).toBeInTheDocument();
  });

  it("顯示第一則訊息", () => {
    renderTC({ state: revealedWith2 });
    expect(screen.getByTestId("tc-msg-m1")).toHaveTextContent("願你平安");
  });

  it("顯示第二則訊息", () => {
    renderTC({ state: revealedWith2 });
    expect(screen.getByTestId("tc-msg-m2")).toHaveTextContent("繼續前行");
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderTC({ state: revealedWith2 });
    expect(screen.getByTestId("tc-author-m1")).toHaveTextContent("Alice");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderTC({
      state: revealedWith2,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("tc-author-m1")).not.toBeInTheDocument();
  });
});
