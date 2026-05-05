import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TwoColumn, {
  TwoColumnConfig,
  TwoColumnState,
  ColumnItem,
} from "../TwoColumn";

const baseConfig: TwoColumnConfig = {
  title: "雙欄測試",
  leftLabel: "優點",
  rightLabel: "缺點",
  maxLength: 60,
};

const emptyState: TwoColumnState = { items: [], revealed: false };

const items: ColumnItem[] = [
  { itemId: "i1", userId: "u1", userName: "Alice", text: "速度快", column: "left" },
  { itemId: "i2", userId: "u1", userName: "Alice", text: "成本高", column: "right" },
  { itemId: "i3", userId: "u2", userName: "Bob", text: "好維護", column: "left" },
];

const revealedState: TwoColumnState = { items, revealed: true };

function renderTc(overrides: Partial<Parameters<typeof TwoColumn>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u3",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<TwoColumn {...props} />), props };
}

describe("TwoColumn — 基本渲染", () => {
  it("顯示標題", () => {
    renderTc();
    expect(screen.getByTestId("tc-title")).toHaveTextContent("雙欄測試");
  });

  it("顯示左欄按鈕", () => {
    renderTc();
    expect(screen.getByTestId("tc-col-left")).toHaveTextContent("優點");
  });

  it("顯示右欄按鈕", () => {
    renderTc();
    expect(screen.getByTestId("tc-col-right")).toHaveTextContent("缺點");
  });

  it("顯示輸入框", () => {
    renderTc();
    expect(screen.getByTestId("tc-input")).toBeInTheDocument();
  });

  it("顯示總計數 0", () => {
    renderTc();
    expect(screen.getByTestId("tc-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderTc();
    expect(screen.getByTestId("tc-reveal-btn")).toBeInTheDocument();
  });
});

describe("TwoColumn — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderTc();
    expect(screen.getByTestId("tc-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderTc();
    fireEvent.change(screen.getByTestId("tc-input"), {
      target: { value: "速度快" },
    });
    expect(screen.getByTestId("tc-submit-btn")).not.toBeDisabled();
  });

  it("預設新增到左欄（優點）", () => {
    const onSubmit = vi.fn();
    renderTc({ onSubmit });
    fireEvent.change(screen.getByTestId("tc-input"), {
      target: { value: "速度快" },
    });
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("速度快", "left");
  });

  it("切換右欄後新增到右欄（缺點）", () => {
    const onSubmit = vi.fn();
    renderTc({ onSubmit });
    fireEvent.click(screen.getByTestId("tc-col-right"));
    fireEvent.change(screen.getByTestId("tc-input"), {
      target: { value: "成本高" },
    });
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("成本高", "right");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderTc({ onReveal });
    fireEvent.click(screen.getByTestId("tc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已有 3 筆顯示計數 3", () => {
    renderTc({ state: { items, revealed: false } });
    expect(screen.getByTestId("tc-count")).toHaveTextContent("3");
  });

  it("可多次送出不同欄位", () => {
    const onSubmit = vi.fn();
    renderTc({ onSubmit });
    fireEvent.change(screen.getByTestId("tc-input"), {
      target: { value: "優點一" },
    });
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("TwoColumn — 公布結果", () => {
  it("公布後顯示 tc-result", () => {
    renderTc({ state: revealedState });
    expect(screen.getByTestId("tc-result")).toBeInTheDocument();
  });

  it("公布後顯示左欄結果", () => {
    renderTc({ state: revealedState });
    expect(screen.getByTestId("tc-result-left")).toBeInTheDocument();
  });

  it("公布後顯示右欄結果", () => {
    renderTc({ state: revealedState });
    expect(screen.getByTestId("tc-result-right")).toBeInTheDocument();
  });

  it("顯示左欄內容", () => {
    renderTc({ state: revealedState });
    expect(screen.getByTestId("tc-item-i1")).toHaveTextContent("速度快");
    expect(screen.getByTestId("tc-item-i3")).toHaveTextContent("好維護");
  });

  it("顯示右欄內容", () => {
    renderTc({ state: revealedState });
    expect(screen.getByTestId("tc-item-i2")).toHaveTextContent("成本高");
  });

  it("無任何内容顯示 tc-empty", () => {
    renderTc({ state: { items: [], revealed: true } });
    expect(screen.getByTestId("tc-empty")).toBeInTheDocument();
  });
});
