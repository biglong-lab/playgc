import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeCheck, TimeCheckConfig, TimeCheckState } from "../TimeCheck";

const baseConfig: TimeCheckConfig = {
  title: "進度回報測試",
  question: "你現在在哪？",
  milestones: ["初始", "進行中", "完成"],
};

const emptyState: TimeCheckState = { checks: [], revealed: false };

function makeEntry(id: string, userId: string, milestoneIndex: number) {
  return { checkId: id, userId, userName: `U${userId}`, milestoneIndex };
}

describe("TimeCheck", () => {
  it("顯示標題和問題", () => {
    render(
      <TimeCheck
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-title")).toHaveTextContent("進度回報測試");
    expect(screen.getByTestId("tc-question")).toHaveTextContent("你現在在哪？");
  });

  it("未提交時顯示里程碑列表", () => {
    render(
      <TimeCheck
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-milestone-list")).toBeInTheDocument();
    expect(screen.getByTestId("tc-milestone-0")).toBeInTheDocument();
    expect(screen.getByTestId("tc-milestone-1")).toBeInTheDocument();
    expect(screen.getByTestId("tc-milestone-2")).toBeInTheDocument();
  });

  it("無人回報時顯示 tc-empty", () => {
    render(
      <TimeCheck
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-empty")).toBeInTheDocument();
  });

  it("點擊里程碑呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <TimeCheck
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("tc-milestone-1"));
    expect(onSubmit).toHaveBeenCalledWith(1);
  });

  it("已提交顯示 tc-my-entry", () => {
    const state: TimeCheckState = {
      checks: [makeEntry("c1", "u1", 2)],
      revealed: false,
    };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("tc-milestone-list")).not.toBeInTheDocument();
  });

  it("isTeamLead 且有回報時顯示揭曉按鈕", () => {
    const state: TimeCheckState = {
      checks: [makeEntry("c1", "u2", 1)],
      revealed: false,
    };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示 tc-result 和計數", () => {
    const state: TimeCheckState = {
      checks: [
        makeEntry("c1", "u1", 0),
        makeEntry("c2", "u2", 1),
        makeEntry("c3", "u3", 1),
      ],
      revealed: true,
    };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u4"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-result")).toBeInTheDocument();
    expect(screen.getByTestId("tc-tally-0")).toBeInTheDocument();
    expect(screen.getByTestId("tc-tally-1")).toBeInTheDocument();
  });

  it("揭曉後無資料顯示 tc-empty", () => {
    const state: TimeCheckState = { checks: [], revealed: true };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-empty")).toBeInTheDocument();
  });

  it("tc-count 顯示正確人數", () => {
    const state: TimeCheckState = {
      checks: [makeEntry("c1", "u1", 0), makeEntry("c2", "u2", 2)],
      revealed: false,
    };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-count")).toHaveTextContent("2 人已回報");
  });

  it("揭曉後顯示個別 entry", () => {
    const state: TimeCheckState = {
      checks: [makeEntry("chk-xyz", "u1", 1)],
      revealed: true,
    };
    render(
      <TimeCheck
        config={baseConfig}
        state={state}
        userId="u2"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tc-entry-chk-xyz")).toBeInTheDocument();
  });
});
