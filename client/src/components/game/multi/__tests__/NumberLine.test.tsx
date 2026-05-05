import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberLine } from "../NumberLine";
import type { NumberLineConfig, NumberLineState } from "../NumberLine";

const cfg: NumberLineConfig = {
  title: "數字定位",
  question: "你有幾分把握？",
  min: 1,
  max: 10,
  unit: "分",
  lowLabel: "不確定",
  highLabel: "有把握",
};

const emptyState: NumberLineState = { placements: [], revealed: false };

const withPlacement: NumberLineState = {
  placements: [{ placementId: "p1", userId: "u1", userName: "Alice", value: 7 }],
  revealed: false,
};

const revealedState: NumberLineState = {
  placements: [
    { placementId: "p1", userId: "u1", userName: "Alice", value: 7 },
    { placementId: "p2", userId: "u2", userName: "Bob", value: 5 },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof NumberLine>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<NumberLine {...defaults} {...overrides} />);
}

describe("NumberLine", () => {
  it("顯示標題與問題", () => {
    make();
    expect(screen.getByTestId("nl-title").textContent).toBe("數字定位");
    expect(screen.getByTestId("nl-question").textContent).toBe("你有幾分把握？");
  });

  it("顯示人數計數", () => {
    make({ state: withPlacement });
    expect(screen.getByTestId("nl-count").textContent).toContain("1");
  });

  it("顯示滑桿與送出按鈕", () => {
    make();
    expect(screen.getByTestId("nl-slider")).toBeTruthy();
    expect(screen.getByTestId("nl-submit-btn")).toBeTruthy();
  });

  it("點擊送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.click(screen.getByTestId("nl-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交顯示 nl-my-placement", () => {
    make({ state: withPlacement, userId: "u1" });
    expect(screen.getByTestId("nl-my-placement")).toBeTruthy();
  });

  it("隊長看到 reveal 按鈕", () => {
    make({ state: withPlacement, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("nl-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: withPlacement, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("nl-reveal-btn")).toBeNull();
  });

  it("revealed 顯示平均值與長條圖", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("nl-result")).toBeTruthy();
    expect(screen.getByTestId("nl-avg")).toBeTruthy();
  });

  it("revealed 顯示每個人的分佈", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("nl-placement-p1")).toBeTruthy();
    expect(screen.getByTestId("nl-placement-p2")).toBeTruthy();
  });

  it("loading 顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
