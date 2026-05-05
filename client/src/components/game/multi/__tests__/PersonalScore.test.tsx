import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalScore, PersonalScoreConfig, PersonalScoreState } from "../PersonalScore";

const baseConfig: PersonalScoreConfig = {
  title: "自評量表測試",
  prompt: "請評分",
  criteria: ["溝通", "合作", "創意"],
  maxScore: 5,
};

const emptyState: PersonalScoreState = { scores: [], revealed: false };

function makeEntry(id: string, userId: string, ratings: number[]) {
  return { scoreId: id, userId, userName: `U${userId}`, ratings };
}

describe("PersonalScore", () => {
  it("顯示標題和提示", () => {
    render(
      <PersonalScore
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-title")).toHaveTextContent("自評量表測試");
    expect(screen.getByTestId("ps-prompt")).toHaveTextContent("請評分");
  });

  it("未提交時顯示評分滑桿", () => {
    render(
      <PersonalScore
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-slider-0")).toBeInTheDocument();
    expect(screen.getByTestId("ps-slider-1")).toBeInTheDocument();
    expect(screen.getByTestId("ps-slider-2")).toBeInTheDocument();
  });

  it("無人評分顯示 ps-empty", () => {
    render(
      <PersonalScore
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-empty")).toBeInTheDocument();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <PersonalScore
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("ps-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Array));
  });

  it("已提交顯示 ps-my-entry", () => {
    const state: PersonalScoreState = {
      scores: [makeEntry("s1", "u1", [3, 4, 5])],
      revealed: false,
    };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("ps-submit-btn")).not.toBeInTheDocument();
  });

  it("isTeamLead 且有評分時顯示揭曉按鈕", () => {
    const state: PersonalScoreState = {
      scores: [makeEntry("s1", "u2", [3, 3, 3])],
      revealed: false,
    };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示 ps-result 和平均分", () => {
    const state: PersonalScoreState = {
      scores: [
        makeEntry("s1", "u1", [4, 3, 5]),
        makeEntry("s2", "u2", [2, 5, 3]),
      ],
      revealed: true,
    };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-result")).toBeInTheDocument();
    expect(screen.getByTestId("ps-avg-0")).toBeInTheDocument();
  });

  it("揭曉後無資料顯示 ps-empty", () => {
    const state: PersonalScoreState = { scores: [], revealed: true };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-empty")).toBeInTheDocument();
  });

  it("ps-count 顯示正確人數", () => {
    const state: PersonalScoreState = {
      scores: [makeEntry("s1", "u1", [3, 3, 3]), makeEntry("s2", "u2", [4, 4, 4])],
      revealed: false,
    };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-count")).toHaveTextContent("2 人已評分");
  });

  it("揭曉後顯示個別 entry", () => {
    const state: PersonalScoreState = {
      scores: [makeEntry("score-abc", "u1", [3, 4, 5])],
      revealed: true,
    };
    render(
      <PersonalScore
        config={baseConfig}
        state={state}
        userId="u2"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-entry-score-abc")).toBeInTheDocument();
  });

  it("顯示所有 criteria", () => {
    render(
      <PersonalScore
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ps-criterion-0")).toBeInTheDocument();
    expect(screen.getByTestId("ps-criterion-1")).toBeInTheDocument();
    expect(screen.getByTestId("ps-criterion-2")).toBeInTheDocument();
  });
});
