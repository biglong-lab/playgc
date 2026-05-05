import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategorySort from "../CategorySort";
import type { CategorySortConfig, CategorySortState } from "../CategorySort";

const defaultConfig: CategorySortConfig = {
  title: "🗂️ 企業文化分類",
  instructions: "請將以下行為分類",
  items: [
    { id: "i1", label: "每日站立會議" },
    { id: "i2", label: "程式碼審查" },
    { id: "i3", label: "部署流程" },
  ],
  categories: [
    { id: "c1", label: "流程", color: "#3B82F6" },
    { id: "c2", label: "技術", color: "#10B981" },
    { id: "c3", label: "團隊", color: "#F59E0B" },
  ],
  showConsensus: true,
};

const emptyState: CategorySortState = { sorts: [] };

const sort1 = {
  userId: "u1",
  userName: "Alice",
  assignments: [
    { itemId: "i1", categoryId: "c3" },
    { itemId: "i2", categoryId: "c2" },
    { itemId: "i3", categoryId: "c1" },
  ],
  submittedAt: 1000,
};

const sort2 = {
  userId: "u2",
  userName: "Bob",
  assignments: [
    { itemId: "i1", categoryId: "c1" },
    { itemId: "i2", categoryId: "c2" },
    { itemId: "i3", categoryId: "c1" },
  ],
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localAssignments: {} as Record<string, string>,
  onAssign: vi.fn(),
  onSubmit: vi.fn(),
};

describe("CategorySort", () => {
  it("顯示標題", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-title")).toHaveTextContent("企業文化分類");
  });

  it("顯示說明文字", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-instructions")).toHaveTextContent("請將以下行為分類");
  });

  it("無說明時不顯示說明區域", () => {
    const config = { ...defaultConfig, instructions: undefined };
    render(<CategorySort {...mockProps} config={config} />);
    expect(screen.queryByTestId("cs-instructions")).not.toBeInTheDocument();
  });

  it("顯示所有項目卡片", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-item-i1")).toBeInTheDocument();
    expect(screen.getByTestId("cs-item-i2")).toBeInTheDocument();
    expect(screen.getByTestId("cs-item-i3")).toBeInTheDocument();
  });

  it("顯示項目標籤文字", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-item-label-i1")).toHaveTextContent("每日站立會議");
  });

  it("每個項目顯示所有分類按鈕", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-assign-i1-c1")).toBeInTheDocument();
    expect(screen.getByTestId("cs-assign-i1-c2")).toBeInTheDocument();
    expect(screen.getByTestId("cs-assign-i1-c3")).toBeInTheDocument();
  });

  it("點擊分類按鈕呼叫 onAssign", () => {
    const onAssign = vi.fn();
    render(<CategorySort {...mockProps} onAssign={onAssign} />);
    fireEvent.click(screen.getByTestId("cs-assign-i1-c2"));
    expect(onAssign).toHaveBeenCalledWith("i1", "c2");
  });

  it("未完全分類時提交按鈕 disabled", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-submit-btn")).toBeDisabled();
  });

  it("未完全分類時顯示提示", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-incomplete-hint")).toBeInTheDocument();
  });

  it("全部分類後提交按鈕啟用", () => {
    const localAssignments = { i1: "c1", i2: "c2", i3: "c3" };
    render(<CategorySort {...mockProps} localAssignments={localAssignments} />);
    expect(screen.getByTestId("cs-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    const localAssignments = { i1: "c1", i2: "c2", i3: "c3" };
    render(<CategorySort {...mockProps} localAssignments={localAssignments} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("cs-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交時顯示確認訊息", () => {
    const state: CategorySortState = { sorts: [sort1] };
    render(<CategorySort {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("cs-submitted-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("cs-submit-btn")).not.toBeInTheDocument();
  });

  it("顯示回應人數", () => {
    const state: CategorySortState = { sorts: [sort1, sort2] };
    render(<CategorySort {...mockProps} state={state} />);
    expect(screen.getByTestId("cs-count")).toHaveTextContent("2");
  });

  it("有回應且 showConsensus=true 時顯示共識區塊", () => {
    const state: CategorySortState = { sorts: [sort1, sort2] };
    render(<CategorySort {...mockProps} state={state} />);
    expect(screen.getByTestId("cs-consensus")).toBeInTheDocument();
  });

  it("showConsensus=false 不顯示共識區塊", () => {
    const config = { ...defaultConfig, showConsensus: false };
    const state: CategorySortState = { sorts: [sort1] };
    render(<CategorySort {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("cs-consensus")).not.toBeInTheDocument();
  });

  it("無回應時不顯示共識區塊", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.queryByTestId("cs-consensus")).not.toBeInTheDocument();
  });

  it("共識區塊顯示各項目行", () => {
    const state: CategorySortState = { sorts: [sort1, sort2] };
    render(<CategorySort {...mockProps} state={state} />);
    expect(screen.getByTestId("cs-consensus-i1")).toBeInTheDocument();
    expect(screen.getByTestId("cs-consensus-i2")).toBeInTheDocument();
    expect(screen.getByTestId("cs-consensus-i3")).toBeInTheDocument();
  });

  it("共識條形圖顯示每個分類", () => {
    const state: CategorySortState = { sorts: [sort1, sort2] };
    render(<CategorySort {...mockProps} state={state} />);
    expect(screen.getByTestId("cs-bar-i2-c2")).toBeInTheDocument();
  });

  it("選中分類按鈕樣式改變", () => {
    const localAssignments = { i1: "c2" };
    render(<CategorySort {...mockProps} localAssignments={localAssignments} />);
    const btn = screen.getByTestId("cs-assign-i1-c2");
    expect(btn.className).toContain("text-white");
  });

  it("空 sorts 回應人數為 0", () => {
    render(<CategorySort {...mockProps} />);
    expect(screen.getByTestId("cs-count")).toHaveTextContent("0");
  });
});
