import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SpinWheel, {
  SpinWheelConfig,
  SpinWheelState,
} from "../SpinWheel";

const baseConfig: SpinWheelConfig = {
  title: "幸運轉盤",
  prompt: "把你的名字加入轉盤！",
  allowPlayerAdd: true,
};

const emptyState: SpinWheelState = { entries: [], results: [] };

const entriesState: SpinWheelState = {
  entries: [
    { entryId: "e1", userId: "u1", label: "Alice" },
    { entryId: "e2", userId: "u2", label: "Bob" },
    { entryId: "e3", userId: "u3", label: "Carol" },
  ],
  results: [],
};

const resultState: SpinWheelState = {
  ...entriesState,
  results: ["Bob"],
};

function renderSw(
  overrides: Partial<Parameters<typeof SpinWheel>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onAddEntry: vi.fn(),
    onSpin: vi.fn(),
    onRemoveEntry: vi.fn(),
    ...overrides,
  };
  return { ...render(<SpinWheel {...props} />), props };
}

describe("SpinWheel — 基本渲染", () => {
  it("顯示標題", () => {
    renderSw();
    expect(screen.getByTestId("sw-title")).toHaveTextContent("幸運轉盤");
  });

  it("顯示提示語", () => {
    renderSw();
    expect(screen.getByTestId("sw-prompt")).toBeInTheDocument();
  });

  it("空列表時顯示 sw-empty", () => {
    renderSw();
    expect(screen.getByTestId("sw-empty")).toBeInTheDocument();
  });
});

describe("SpinWheel — 加入項目", () => {
  it("顯示輸入框", () => {
    renderSw();
    expect(screen.getByTestId("sw-add-input")).toBeInTheDocument();
  });

  it("空白時加入鈕 disabled", () => {
    renderSw();
    expect(screen.getByTestId("sw-add-btn")).toBeDisabled();
  });

  it("有內容時加入鈕可點", () => {
    renderSw();
    fireEvent.change(screen.getByTestId("sw-add-input"), {
      target: { value: "Alice" },
    });
    expect(screen.getByTestId("sw-add-btn")).not.toBeDisabled();
  });

  it("點加入呼叫 onAddEntry", () => {
    const onAddEntry = vi.fn();
    renderSw({ onAddEntry });
    fireEvent.change(screen.getByTestId("sw-add-input"), {
      target: { value: "Alice" },
    });
    fireEvent.click(screen.getByTestId("sw-add-btn"));
    expect(onAddEntry).toHaveBeenCalledWith("Alice");
  });

  it("allowPlayerAdd=false 時不顯示輸入框", () => {
    renderSw({
      config: { ...baseConfig, allowPlayerAdd: false },
    });
    expect(
      screen.queryByTestId("sw-add-input")
    ).not.toBeInTheDocument();
  });
});

describe("SpinWheel — 轉動", () => {
  it("無項目時轉動按鈕 disabled", () => {
    renderSw();
    expect(screen.getByTestId("sw-spin-btn")).toBeDisabled();
  });

  it("有項目時轉動按鈕可點", () => {
    renderSw({ state: entriesState });
    expect(screen.getByTestId("sw-spin-btn")).not.toBeDisabled();
  });

  it("點轉動呼叫 onSpin", () => {
    const onSpin = vi.fn();
    renderSw({ state: entriesState, onSpin });
    fireEvent.click(screen.getByTestId("sw-spin-btn"));
    expect(onSpin).toHaveBeenCalledTimes(1);
  });

  it("有結果時顯示 sw-result", () => {
    renderSw({ state: resultState });
    expect(screen.getByTestId("sw-result")).toBeInTheDocument();
  });

  it("顯示中獎標籤", () => {
    renderSw({ state: resultState });
    expect(screen.getByTestId("sw-result-label")).toHaveTextContent(
      "Bob"
    );
  });

  it("顯示轉動歷史次數", () => {
    renderSw({ state: resultState });
    expect(screen.getByTestId("sw-history")).toBeInTheDocument();
  });

  it("無結果時不顯示 sw-result", () => {
    renderSw({ state: entriesState });
    expect(screen.queryByTestId("sw-result")).not.toBeInTheDocument();
  });
});

describe("SpinWheel — 項目列表", () => {
  it("顯示所有項目", () => {
    renderSw({ state: entriesState });
    expect(screen.getByTestId("sw-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("sw-entry-e2")).toBeInTheDocument();
    expect(screen.getByTestId("sw-entry-e3")).toBeInTheDocument();
  });

  it("自己的項目顯示移除按鈕", () => {
    renderSw({ state: entriesState });
    expect(screen.getByTestId("sw-remove-e1")).toBeInTheDocument();
  });

  it("他人的項目不顯示移除按鈕", () => {
    renderSw({ state: entriesState });
    expect(
      screen.queryByTestId("sw-remove-e2")
    ).not.toBeInTheDocument();
  });

  it("點移除呼叫 onRemoveEntry", () => {
    const onRemoveEntry = vi.fn();
    renderSw({ state: entriesState, onRemoveEntry });
    fireEvent.click(screen.getByTestId("sw-remove-e1"));
    expect(onRemoveEntry).toHaveBeenCalledWith("e1");
  });
});
