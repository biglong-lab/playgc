import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BrainDump, { BrainDumpConfig, BrainDumpState, BrainEntry } from "../BrainDump";

const baseConfig: BrainDumpConfig = {
  title: "腦力傾瀉測試",
  prompt: "盡量多寫想法",
  maxItems: 3,
  maxLength: 40,
};

const emptyState: BrainDumpState = { dumps: [], revealed: false };

const dumps: BrainEntry[] = [
  { dumpId: "d1", userId: "u1", userName: "Alice", ideas: ["想法A", "想法B"] },
  { dumpId: "d2", userId: "u2", userName: "Bob", ideas: ["點子X"] },
];

const revealedState: BrainDumpState = { dumps, revealed: true };

function renderBd(overrides: Partial<Parameters<typeof BrainDump>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<BrainDump {...props} />), props };
}

describe("BrainDump — 基本渲染", () => {
  it("顯示標題", () => {
    renderBd();
    expect(screen.getByTestId("bd-title")).toHaveTextContent("腦力傾瀉測試");
  });

  it("顯示 prompt", () => {
    renderBd();
    expect(screen.getByTestId("bd-prompt")).toHaveTextContent("盡量多寫想法");
  });

  it("顯示第一個輸入框", () => {
    renderBd();
    expect(screen.getByTestId("bd-idea-0")).toBeInTheDocument();
  });

  it("送出鈕初始 disabled", () => {
    renderBd();
    expect(screen.getByTestId("bd-submit-btn")).toBeDisabled();
  });

  it("顯示已提交人數 0", () => {
    renderBd();
    expect(screen.getByTestId("bd-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderBd();
    expect(screen.getByTestId("bd-reveal-btn")).toBeInTheDocument();
  });

  it("顯示加一條按鈕", () => {
    renderBd();
    expect(screen.getByTestId("bd-add-btn")).toBeInTheDocument();
  });
});

describe("BrainDump — 互動", () => {
  it("填寫一條想法後送出鈕可點", () => {
    renderBd();
    fireEvent.change(screen.getByTestId("bd-idea-0"), { target: { value: "好主意" } });
    expect(screen.getByTestId("bd-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶想法陣列", () => {
    const onSubmit = vi.fn();
    renderBd({ onSubmit });
    fireEvent.change(screen.getByTestId("bd-idea-0"), { target: { value: "創意A" } });
    fireEvent.click(screen.getByTestId("bd-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["創意A"]);
  });

  it("點加一條新增輸入框", () => {
    renderBd();
    fireEvent.click(screen.getByTestId("bd-add-btn"));
    expect(screen.getByTestId("bd-idea-1")).toBeInTheDocument();
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderBd({ onReveal });
    fireEvent.click(screen.getByTestId("bd-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 bd-my-dump", () => {
    const myDump: BrainEntry = { dumpId: "d99", userId: "u4", userName: "David", ideas: ["想法1"] };
    renderBd({ state: { dumps: [myDump], revealed: false } });
    expect(screen.getByTestId("bd-my-dump")).toBeInTheDocument();
  });

  it("已提交者不顯示輸入框", () => {
    const myDump: BrainEntry = { dumpId: "d99", userId: "u4", userName: "David", ideas: ["想法1"] };
    renderBd({ state: { dumps: [myDump], revealed: false } });
    expect(screen.queryByTestId("bd-idea-0")).not.toBeInTheDocument();
  });

  it("顯示已提交人數 2", () => {
    renderBd({ state: { dumps, revealed: false } });
    expect(screen.getByTestId("bd-count")).toHaveTextContent("2");
  });
});

describe("BrainDump — 公布結果", () => {
  it("公布後顯示 bd-result", () => {
    renderBd({ state: revealedState });
    expect(screen.getByTestId("bd-result")).toBeInTheDocument();
  });

  it("顯示所有 dump 卡片", () => {
    renderBd({ state: revealedState });
    expect(screen.getByTestId("bd-user-d1")).toBeInTheDocument();
    expect(screen.getByTestId("bd-user-d2")).toBeInTheDocument();
  });

  it("卡片顯示用戶名和想法", () => {
    renderBd({ state: revealedState });
    expect(screen.getByTestId("bd-user-d1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("bd-user-d1")).toHaveTextContent("想法A");
  });

  it("無人提交顯示 bd-empty", () => {
    renderBd({ state: { dumps: [], revealed: true } });
    expect(screen.getByTestId("bd-empty")).toBeInTheDocument();
  });
});
