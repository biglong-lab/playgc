import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HotTake from "../HotTake";
import type { HotTakeConfig, HotTakeState } from "../HotTake";

const defaultConfig: HotTakeConfig = {
  title: "🔥 熱議話題",
  instructions: "說出你最有爭議的想法",
  maxLength: 60,
  maxTakesPerPerson: 2,
  reactions: ["🔥", "💯", "🤔"],
};

const emptyState: HotTakeState = { takes: [] };

const take1 = {
  id: "t1",
  text: "台南無敵好吃",
  authorId: "u1",
  authorName: "Alice",
  reactions: { "🔥": ["u2"], "💯": [] },
  submittedAt: 2000,
};

const take2 = {
  id: "t2",
  text: "台北比較方便",
  authorId: "u2",
  authorName: "Bob",
  reactions: {},
  submittedAt: 1000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReact: vi.fn(),
};

describe("HotTake", () => {
  it("顯示標題", () => {
    render(<HotTake {...mockProps} />);
    expect(screen.getByTestId("ht-title")).toHaveTextContent("熱議話題");
  });

  it("顯示說明", () => {
    render(<HotTake {...mockProps} />);
    expect(screen.getByTestId("ht-instructions")).toHaveTextContent("最有爭議的想法");
  });

  it("無說明時不顯示", () => {
    const config = { ...defaultConfig, instructions: undefined };
    render(<HotTake {...mockProps} config={config} />);
    expect(screen.queryByTestId("ht-instructions")).not.toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    render(<HotTake {...mockProps} />);
    expect(screen.getByTestId("ht-input")).toBeInTheDocument();
  });

  it("空草稿時提交按鈕 disabled", () => {
    render(<HotTake {...mockProps} />);
    expect(screen.getByTestId("ht-submit-btn")).toBeDisabled();
  });

  it("有草稿時提交按鈕啟用", () => {
    render(<HotTake {...mockProps} draftText="我的看法" />);
    expect(screen.getByTestId("ht-submit-btn")).not.toBeDisabled();
  });

  it("輸入時呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<HotTake {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("ht-input"), { target: { value: "測試" } });
    expect(onDraftChange).toHaveBeenCalledWith("測試");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<HotTake {...mockProps} draftText="好想法" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("ht-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("顯示剩餘字數", () => {
    render(<HotTake {...mockProps} draftText="12345" />);
    expect(screen.getByTestId("ht-chars-left")).toHaveTextContent("55");
  });

  it("達上限顯示提示並隱藏輸入", () => {
    const state: HotTakeState = {
      takes: [
        take1,
        { ...take1, id: "t3", text: "第二則" },
      ],
    };
    render(<HotTake {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("ht-limit-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("ht-input")).not.toBeInTheDocument();
  });

  it("顯示話題數量", () => {
    const state: HotTakeState = { takes: [take1, take2] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-count")).toHaveTextContent("2");
  });

  it("空列表顯示提示", () => {
    render(<HotTake {...mockProps} />);
    expect(screen.getByTestId("ht-empty")).toBeInTheDocument();
  });

  it("顯示每則話題", () => {
    const state: HotTakeState = { takes: [take1, take2] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-take-t1")).toBeInTheDocument();
    expect(screen.getByTestId("ht-take-t2")).toBeInTheDocument();
  });

  it("顯示話題文字", () => {
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-text-t1")).toHaveTextContent("台南無敵好吃");
  });

  it("顯示作者名稱", () => {
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-author-t1")).toHaveTextContent("Alice");
  });

  it("顯示 emoji 反應按鈕", () => {
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-react-t1-🔥")).toBeInTheDocument();
    expect(screen.getByTestId("ht-react-t1-💯")).toBeInTheDocument();
  });

  it("點擊反應呼叫 onReact", () => {
    const onReact = vi.fn();
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} onReact={onReact} />);
    fireEvent.click(screen.getByTestId("ht-react-t1-🔥"));
    expect(onReact).toHaveBeenCalledWith("t1", "🔥");
  });

  it("顯示反應數量", () => {
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-react-count-t1-🔥")).toHaveTextContent("1");
  });

  it("顯示總反應數", () => {
    const state: HotTakeState = { takes: [take1] };
    render(<HotTake {...mockProps} state={state} />);
    expect(screen.getByTestId("ht-reaction-total-t1")).toHaveTextContent("1");
  });
});
