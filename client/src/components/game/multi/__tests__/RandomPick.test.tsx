import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RandomPick, RandomPickConfig, RandomPickState } from "../RandomPick";

const baseConfig: RandomPickConfig = {
  title: "隨機抽選測試",
  prompt: "點擊報名",
  pickCount: 1,
  joinLabel: "我要參加",
  pickLabel: "開始抽選",
};

const emptyState: RandomPickState = { participants: [], picks: [], drawn: false };

function makeParticipant(id: string, userId: string) {
  return { participantId: id, userId, userName: `U${userId}` };
}

describe("RandomPick", () => {
  it("顯示標題和提示", () => {
    render(
      <RandomPick
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-title")).toHaveTextContent("隨機抽選測試");
    expect(screen.getByTestId("rp-prompt")).toHaveTextContent("點擊報名");
  });

  it("未加入時顯示報名按鈕", () => {
    render(
      <RandomPick
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-join-btn")).toBeInTheDocument();
  });

  it("點擊報名按鈕呼叫 onJoin", () => {
    const onJoin = vi.fn();
    render(
      <RandomPick
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onJoin={onJoin}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("rp-join-btn"));
    expect(onJoin).toHaveBeenCalled();
  });

  it("無人報名時顯示 rp-empty", () => {
    render(
      <RandomPick
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-empty")).toBeInTheDocument();
  });

  it("已加入時顯示 rp-joined", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u1")],
      picks: [],
      drawn: false,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-joined")).toBeInTheDocument();
    expect(screen.queryByTestId("rp-join-btn")).not.toBeInTheDocument();
  });

  it("isTeamLead 且有報名時顯示抽選按鈕", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u2")],
      picks: [],
      drawn: false,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-draw-btn")).toBeInTheDocument();
  });

  it("isTeamLead 點擊抽選呼叫 onDraw", () => {
    const onDraw = vi.fn();
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u2")],
      picks: [],
      drawn: false,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onJoin={vi.fn()}
        onDraw={onDraw}
        onReset={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("rp-draw-btn"));
    expect(onDraw).toHaveBeenCalled();
  });

  it("抽選後顯示 rp-result 和結果", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u2"), makeParticipant("p2", "u3")],
      picks: [makeParticipant("p1", "u2")],
      drawn: true,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-result")).toBeInTheDocument();
    expect(screen.getByTestId("rp-pick-p1")).toBeInTheDocument();
  });

  it("中獎者看到恭喜訊息", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u1")],
      picks: [makeParticipant("p1", "u1")],
      drawn: true,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-winner-banner")).toBeInTheDocument();
  });

  it("isTeamLead 抽選後顯示重新抽選", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u2")],
      picks: [makeParticipant("p1", "u2")],
      drawn: true,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-reset-btn")).toBeInTheDocument();
  });

  it("rp-count 顯示正確人數", () => {
    const state: RandomPickState = {
      participants: [makeParticipant("p1", "u1"), makeParticipant("p2", "u2")],
      picks: [],
      drawn: false,
    };
    render(
      <RandomPick
        config={baseConfig}
        state={state}
        userId="u3"
        onJoin={vi.fn()}
        onDraw={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByTestId("rp-count")).toHaveTextContent("2 人報名");
  });
});
