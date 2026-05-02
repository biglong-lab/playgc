import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProgressQuest, {
  buildInitialProgressState,
  calculateProgress,
  detectNewMilestones,
} from "../ProgressQuest";

beforeEach(() => {
  vi.mocked(localStorage.getItem).mockReset();
});

describe("ProgressQuest", () => {
  it("hostMode 顯示標題 + 進度百分比", () => {
    render(
      <ProgressQuest
        config={{ title: "金門街區走讀" }}
        hostMode={true}
        state={{
          completed: 25,
          totalTasks: 100,
          contributors: { Alice: 10, Bob: 8, Charlie: 7 },
          milestonesReached: [],
        }}
      />,
    );
    expect(screen.getByText(/金門街區走讀/)).toBeInTheDocument();
    // 25% 出現在進度條 + 里程碑刻度（多個位置）
    const matches = screen.getAllByText(/25%/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("hostMode 顯示貢獻榜 top 5", () => {
    render(
      <ProgressQuest
        config={{}}
        hostMode={true}
        state={{
          completed: 30,
          totalTasks: 100,
          contributors: { A: 10, B: 8, C: 6, D: 4, E: 2 },
          milestonesReached: [25],
        }}
      />,
    );
    expect(screen.getByText(/🥇/)).toBeInTheDocument();
    expect(screen.getByText(/×10/)).toBeInTheDocument();
  });

  it("hostMode 達成里程碑時顯示慶祝動畫", () => {
    render(
      <ProgressQuest
        config={{}}
        hostMode={true}
        state={{
          completed: 50,
          totalTasks: 100,
          contributors: {},
          milestonesReached: [25, 50],
        }}
      />,
    );
    expect(screen.getByTestId("celebration-overlay")).toBeInTheDocument();
    expect(screen.getByText(/50% 達成/)).toBeInTheDocument();
  });

  it("玩家端 - 顯示進度 + 我的貢獻 + 推進按鈕", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    render(
      <ProgressQuest
        config={{ title: "test" }}
        hostMode={false}
        state={{
          completed: 25,
          totalTasks: 100,
          contributors: { Hung: 5 },
          milestonesReached: [],
        }}
      />,
    );
    expect(screen.getByTestId("btn-progress-complete")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // 我的貢獻
  });

  it("玩家端 - 點擊推進 onPulse", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    const onPulse = vi.fn();
    render(<ProgressQuest config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-progress-complete"));
    expect(onPulse).toHaveBeenCalledWith("complete", { userId: "Hung" });
  });

  it("玩家端 - 已達 100% 時按鈕 disabled", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    render(
      <ProgressQuest
        config={{ totalTasks: 5 }}
        hostMode={false}
        state={{
          completed: 5,
          totalTasks: 5,
          contributors: {},
          milestonesReached: [100],
        }}
      />,
    );
    const btn = screen.getByTestId("btn-progress-complete") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn).toHaveTextContent(/全場已完成/);
  });

  it("calculateProgress 正確計算百分比", () => {
    expect(calculateProgress(25, 100)).toBe(25);
    expect(calculateProgress(0, 100)).toBe(0);
    expect(calculateProgress(150, 100)).toBe(100); // 防超過
    expect(calculateProgress(0, 0)).toBe(0); // 防 div by 0
    expect(calculateProgress(33, 100)).toBe(33);
  });

  it("detectNewMilestones 偵測本次跨過的里程碑", () => {
    expect(detectNewMilestones(20, 30, [25, 50, 75, 100])).toEqual([25]);
    expect(detectNewMilestones(20, 80, [25, 50, 75, 100])).toEqual([25, 50, 75]);
    expect(detectNewMilestones(0, 100, [25, 50, 75, 100])).toEqual([25, 50, 75, 100]);
    expect(detectNewMilestones(50, 60, [25, 50, 75, 100])).toEqual([]);
  });

  it("buildInitialProgressState 套用 config 預設值", () => {
    const state = buildInitialProgressState({ totalTasks: 50 });
    expect(state.completed).toBe(0);
    expect(state.totalTasks).toBe(50);
    expect(state.contributors).toEqual({});
    expect(state.milestonesReached).toEqual([]);

    const fallback = buildInitialProgressState({});
    expect(fallback.totalTasks).toBe(100);
  });
});
