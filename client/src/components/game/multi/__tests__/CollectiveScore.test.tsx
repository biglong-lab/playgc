import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CollectiveScore from "../CollectiveScore";
import type { CollectiveScoreConfig, CollectiveScoreProps } from "../CollectiveScore";

const config: CollectiveScoreConfig = {
  title: "全員加油",
  subtitle: "一起累積分數",
  targetScore: 500,
};

const baseProps: CollectiveScoreProps = {
  config,
  state: { totalScore: 0, contributors: [], isReached: false },
  myUserName: "Alice",
  onContribute: vi.fn(),
};

describe("CollectiveScore", () => {
  it("顯示標題", () => {
    render(<CollectiveScore {...baseProps} />);
    expect(screen.getByText("全員加油")).toBeInTheDocument();
  });

  it("顯示 subtitle", () => {
    render(<CollectiveScore {...baseProps} />);
    expect(screen.getByText("一起累積分數")).toBeInTheDocument();
  });

  it("顯示當前分數與目標分數", () => {
    render(<CollectiveScore {...baseProps} />);
    // 分數區有 0 和 500，目標分數可能多處出現，用 getAllByText
    expect(screen.getByText("0")).toBeInTheDocument();
    const all500 = screen.getAllByText("500");
    expect(all500.length).toBeGreaterThanOrEqual(1);
  });

  it("顯示差距說明", () => {
    render(<CollectiveScore {...baseProps} />);
    expect(screen.getByText(/還差/)).toBeInTheDocument();
  });

  it("有預設三個加分按鈕", () => {
    render(<CollectiveScore {...baseProps} />);
    expect(screen.getByTestId("btn-contribute-10")).toBeInTheDocument();
    expect(screen.getByTestId("btn-contribute-50")).toBeInTheDocument();
    expect(screen.getByTestId("btn-contribute-100")).toBeInTheDocument();
  });

  it("點擊加分按鈕呼叫 onContribute", () => {
    const onContribute = vi.fn();
    render(<CollectiveScore {...baseProps} onContribute={onContribute} />);
    fireEvent.click(screen.getByTestId("btn-contribute-50"));
    expect(onContribute).toHaveBeenCalledWith(50);
  });

  it("有自訂 addOptions 時按正確 delta 呼叫", () => {
    const onContribute = vi.fn();
    const cfg: CollectiveScoreConfig = { ...config, addOptions: [{ label: "+5", delta: 5 }, { label: "+25", delta: 25 }] };
    render(<CollectiveScore {...baseProps} config={cfg} onContribute={onContribute} />);
    fireEvent.click(screen.getByTestId("btn-contribute-5"));
    expect(onContribute).toHaveBeenCalledWith(5);
  });

  it("有貢獻時顯示排行", () => {
    const state = {
      totalScore: 150,
      contributors: [
        { name: "Alice", total: 100 },
        { name: "Bob", total: 50 },
      ],
      isReached: false,
    };
    render(<CollectiveScore {...baseProps} state={state} />);
    expect(screen.getByText(/隊員貢獻排行/)).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("顯示我的貢獻", () => {
    const state = {
      totalScore: 100,
      contributors: [{ name: "Alice", total: 100 }],
      isReached: false,
    };
    render(<CollectiveScore {...baseProps} state={state} />);
    expect(screen.getByText(/我的貢獻：/)).toBeInTheDocument();
  });

  it("isReached=true 顯示達標慶祝", () => {
    const state = { totalScore: 500, contributors: [], isReached: true };
    render(<CollectiveScore {...baseProps} state={state} />);
    expect(screen.getByText("達標！")).toBeInTheDocument();
  });

  it("達標時顯示全隊分數慶祝文字", () => {
    const state = { totalScore: 500, contributors: [], isReached: true };
    render(<CollectiveScore {...baseProps} state={state} />);
    expect(screen.getByText(/全隊累積 500 分/)).toBeInTheDocument();
  });

  it("達標後顯示貢獻排行", () => {
    const state = {
      totalScore: 500,
      contributors: [{ name: "Alice", total: 300 }, { name: "Bob", total: 200 }],
      isReached: true,
    };
    render(<CollectiveScore {...baseProps} state={state} />);
    expect(screen.getByText(/隊員貢獻/)).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("state=null 時顯示 0 分", () => {
    render(<CollectiveScore {...baseProps} state={null} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
