import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DotVote from "../DotVote";
import type { DotVoteConfig, DotVoteState, DotAllocation } from "../DotVote";

const defaultConfig: DotVoteConfig = {
  title: "🔵 工作坊優先排序",
  question: "把你的三個點分給最重要的選項",
  options: [
    { id: "o1", label: "溝通", emoji: "💬" },
    { id: "o2", label: "效率", emoji: "⚡" },
    { id: "o3", label: "創新", emoji: "💡" },
  ],
  dotsPerPerson: 3,
  showResultsLive: true,
};

const emptyState: DotVoteState = { allocations: [] };

const alloc1: DotAllocation = {
  userId: "u1",
  userName: "Alice",
  allocations: [
    { optionId: "o1", count: 2 },
    { optionId: "o2", count: 1 },
    { optionId: "o3", count: 0 },
  ],
  submittedAt: Date.now(),
};

const defaultDraft = { o1: 0, o2: 0, o3: 0 };

describe("DotVote", () => {
  it("顯示標題", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("dot-vote-title")).toHaveTextContent("工作坊優先排序");
  });

  it("顯示問題", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("dot-vote-question")).toHaveTextContent("三個點");
  });

  it("顯示三個選項", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("dot-option-o1")).toBeInTheDocument();
    expect(screen.getByTestId("dot-option-o2")).toBeInTheDocument();
    expect(screen.getByTestId("dot-option-o3")).toBeInTheDocument();
  });

  it("顯示剩餘點數", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("remaining-dots")).toHaveTextContent("3");
  });

  it("顯示加減按鈕", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("add-dot-o1")).toBeInTheDocument();
    expect(screen.getByTestId("remove-dot-o1")).toBeInTheDocument();
  });

  it("點擊加點呼叫 onAdd", () => {
    const onAdd = vi.fn();
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={onAdd} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("add-dot-o1"));
    expect(onAdd).toHaveBeenCalledWith("o1");
  });

  it("點擊減點呼叫 onRemove", () => {
    const onRemove = vi.fn();
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={{ o1: 1, o2: 0, o3: 0 }} remainingDots={2} onAdd={vi.fn()} onRemove={onRemove} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("remove-dot-o1"));
    expect(onRemove).toHaveBeenCalledWith("o1");
  });

  it("點數為 0 時減點按鈕 disabled", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("remove-dot-o1")).toBeDisabled();
  });

  it("剩餘點數 0 時加點按鈕 disabled", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={{ o1: 3, o2: 0, o3: 0 }} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("add-dot-o2")).toBeDisabled();
  });

  it("剩餘點數 > 0 時提交按鈕 disabled", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={defaultDraft} remainingDots={3} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-dots-btn")).toBeDisabled();
  });

  it("剩餘點數 = 0 時提交按鈕啟用", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={{ o1: 3, o2: 0, o3: 0 }} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-dots-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={{ o1: 3, o2: 0, o3: 0 }} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId("submit-dots-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交顯示 already-submitted", () => {
    render(
      <DotVote config={defaultConfig} state={{ allocations: [alloc1] }} myUserId="u1" draft={defaultDraft} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("already-submitted")).toBeInTheDocument();
  });

  it("已提交後隱藏加減按鈕", () => {
    render(
      <DotVote config={defaultConfig} state={{ allocations: [alloc1] }} myUserId="u1" draft={defaultDraft} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByTestId("add-dot-o1")).not.toBeInTheDocument();
  });

  it("顯示已投票人數", () => {
    render(
      <DotVote config={defaultConfig} state={{ allocations: [alloc1] }} myUserId="u1" draft={defaultDraft} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("participant-count")).toHaveTextContent("1");
  });

  it("showResultsLive 時顯示 option-bar", () => {
    render(
      <DotVote config={defaultConfig} state={{ allocations: [alloc1] }} myUserId="u1" draft={defaultDraft} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("option-bar-o1")).toBeInTheDocument();
  });

  it("total-dots 顯示正確累計點數", () => {
    render(
      <DotVote config={defaultConfig} state={{ allocations: [alloc1] }} myUserId="u1" draft={defaultDraft} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("total-dots-o1")).toHaveTextContent("2");
    expect(screen.getByTestId("total-dots-o2")).toHaveTextContent("1");
  });

  it("顯示草稿中的 local-count", () => {
    render(
      <DotVote config={defaultConfig} state={emptyState} myUserId="u1" draft={{ o1: 2, o2: 0, o3: 1 }} remainingDots={0} onAdd={vi.fn()} onRemove={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("local-count-o1")).toHaveTextContent("2");
    expect(screen.getByTestId("local-count-o3")).toHaveTextContent("1");
  });
});
