import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GpsCascade from "../GpsCascade";

const sampleConfig = {
  title: "金門巡禮",
  points: [
    { id: "p1", name: "後浦老街", hint: "找入口的牌樓" },
    { id: "p2", name: "賈村牌坊", hint: "從後浦往南 200m" },
    { id: "p3", name: "莒光樓", hint: "南方海岸地標" },
  ],
};

describe("GpsCascade", () => {
  it("顯示標題 + 第一站當前", () => {
    render(
      <GpsCascade config={sampleConfig} state={{ reachedPointIds: [] }} onReachPoint={() => {}} />,
    );
    expect(screen.getByText("金門巡禮")).toBeInTheDocument();
    // 後浦老街可能在「下一站」+ 「完整路線」兩處 → 用 getAllByText
    expect(screen.getAllByText(/後浦老街/).length).toBeGreaterThan(0);
    expect(screen.getByText(/找入口的牌樓/)).toBeInTheDocument();
    expect(screen.getByTestId("btn-reach-p1")).toBeInTheDocument();
  });

  it("點「我到了」觸發 onReachPoint", () => {
    const onReach = vi.fn();
    render(
      <GpsCascade config={sampleConfig} state={{ reachedPointIds: [] }} onReachPoint={onReach} />,
    );
    fireEvent.click(screen.getByTestId("btn-reach-p1"));
    expect(onReach).toHaveBeenCalledWith("p1");
  });

  it("已到達 p1 → 顯示 p2 為當前站", () => {
    render(
      <GpsCascade
        config={sampleConfig}
        state={{ reachedPointIds: ["p1"] }}
        onReachPoint={() => {}}
      />,
    );
    expect(screen.getByTestId("btn-reach-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-reach-p1")).not.toBeInTheDocument();
  });

  it("全部到達 → 旅程完成畫面", () => {
    render(
      <GpsCascade
        config={sampleConfig}
        state={{ reachedPointIds: ["p1", "p2", "p3"] }}
        onReachPoint={() => {}}
      />,
    );
    expect(screen.getByText("旅程完成！")).toBeInTheDocument();
    expect(screen.getByText(/走遍 3 個地點/)).toBeInTheDocument();
  });

  it("未解鎖點顯示「解鎖後可見」", () => {
    render(
      <GpsCascade config={sampleConfig} state={{ reachedPointIds: [] }} onReachPoint={() => {}} />,
    );
    // p2/p3 未解鎖 → 顯示 placeholder
    const lockedTexts = screen.getAllByText("（解鎖後可見）");
    expect(lockedTexts.length).toBeGreaterThan(0);
  });
});
