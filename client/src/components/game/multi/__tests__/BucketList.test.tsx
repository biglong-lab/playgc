import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BucketList from "../BucketList";
import type { BucketListConfig, BucketListState } from "../BucketList";

const defaultConfig: BucketListConfig = {
  title: "⭐ 集體願望清單",
  prompt: "寫下你想實現的事！",
  placeholder: "我想要…",
  maxItemsPerPerson: 3,
  maxItemLength: 40,
  allowSupport: true,
};

const emptyState: BucketListState = { items: [] };

const item1 = {
  id: "i1",
  userId: "u2",
  userName: "Bob",
  text: "環島一圈",
  supporters: ["u1", "u3"],
  addedAt: 1000,
};

const item2 = {
  id: "i2",
  userId: "u1",
  userName: "Alice",
  text: "學會衝浪",
  supporters: [],
  addedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onAdd: vi.fn(),
  onSupport: vi.fn(),
};

describe("BucketList", () => {
  it("顯示標題", () => {
    render(<BucketList {...mockProps} />);
    expect(screen.getByTestId("bl-title")).toHaveTextContent("集體願望清單");
  });

  it("顯示提示語", () => {
    render(<BucketList {...mockProps} />);
    expect(screen.getByTestId("bl-prompt")).toHaveTextContent("寫下你想實現的事！");
  });

  it("顯示新增表單", () => {
    render(<BucketList {...mockProps} />);
    expect(screen.getByTestId("bl-add-form")).toBeInTheDocument();
  });

  it("空白時新增按鈕 disabled", () => {
    render(<BucketList {...mockProps} />);
    expect(screen.getByTestId("bl-add-btn")).toBeDisabled();
  });

  it("有文字時新增按鈕啟用", () => {
    render(<BucketList {...mockProps} draftText="環島" />);
    expect(screen.getByTestId("bl-add-btn")).not.toBeDisabled();
  });

  it("輸入文字呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<BucketList {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("bl-draft-input"), { target: { value: "登玉山" } });
    expect(onDraftChange).toHaveBeenCalledWith("登玉山");
  });

  it("點擊新增呼叫 onAdd", () => {
    const onAdd = vi.fn();
    render(<BucketList {...mockProps} draftText="環島" onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("bl-add-btn"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("無願望時顯示空狀態", () => {
    render(<BucketList {...mockProps} />);
    expect(screen.getByTestId("bl-empty")).toBeInTheDocument();
  });

  it("有願望時顯示列表", () => {
    const state: BucketListState = { items: [item1, item2] };
    render(<BucketList {...mockProps} state={state} />);
    expect(screen.getByTestId("bl-item-i1")).toBeInTheDocument();
    expect(screen.getByTestId("bl-item-i2")).toBeInTheDocument();
  });

  it("顯示願望文字", () => {
    const state: BucketListState = { items: [item1] };
    render(<BucketList {...mockProps} state={state} />);
    expect(screen.getByTestId("bl-text-i1")).toHaveTextContent("環島一圈");
  });

  it("顯示支持數", () => {
    const state: BucketListState = { items: [item1] };
    render(<BucketList {...mockProps} state={state} />);
    expect(screen.getByTestId("bl-support-count-i1")).toHaveTextContent("2");
  });

  it("別人的願望支持按鈕可點", () => {
    const state: BucketListState = { items: [item1] };
    render(<BucketList {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("bl-support-btn-i1")).not.toBeDisabled();
  });

  it("自己的願望支持按鈕 disabled", () => {
    const state: BucketListState = { items: [item2] };
    render(<BucketList {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("bl-support-btn-i2")).toBeDisabled();
  });

  it("點擊支持呼叫 onSupport", () => {
    const onSupport = vi.fn();
    const state: BucketListState = { items: [item1] };
    render(<BucketList {...mockProps} state={state} onSupport={onSupport} />);
    fireEvent.click(screen.getByTestId("bl-support-btn-i1"));
    expect(onSupport).toHaveBeenCalledWith("i1");
  });

  it("達到上限後顯示已達上限", () => {
    const myItems = [
      { ...item2, id: "m1" },
      { ...item2, id: "m2" },
      { ...item2, id: "m3" },
    ];
    const state: BucketListState = { items: myItems };
    render(<BucketList {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("bl-max-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("bl-add-form")).not.toBeInTheDocument();
  });

  it("allowSupport=false 不顯示支持按鈕", () => {
    const config = { ...defaultConfig, allowSupport: false };
    const state: BucketListState = { items: [item1] };
    render(<BucketList {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("bl-support-btn-i1")).not.toBeInTheDocument();
  });
});
