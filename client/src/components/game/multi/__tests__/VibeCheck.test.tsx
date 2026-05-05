import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VibeCheck } from "../VibeCheck";
import type { VibeCheckConfig, VibeCheckState } from "../VibeCheck";

const cfg: VibeCheckConfig = {
  title: "氛圍感測",
  prompt: "標記你的感受",
  dimensions: [
    { id: "energy", label: "能量", lowEmoji: "😴", highEmoji: "⚡" },
    { id: "focus", label: "專注", lowEmoji: "🌀", highEmoji: "🎯" },
  ],
};

const emptyState: VibeCheckState = { entries: [], revealed: false };

const withEntry: VibeCheckState = {
  entries: [
    {
      entryId: "e1",
      userId: "u1",
      userName: "Alice",
      scores: { energy: 80, focus: 60 },
    },
  ],
  revealed: false,
};

const revealedState: VibeCheckState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", scores: { energy: 80, focus: 60 } },
    { entryId: "e2", userId: "u2", userName: "Bob", scores: { energy: 40, focus: 70 } },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof VibeCheck>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<VibeCheck {...defaults} {...overrides} />);
}

describe("VibeCheck", () => {
  it("顯示標題與提示", () => {
    make();
    expect(screen.getByTestId("vc-title").textContent).toBe("氛圍感測");
    expect(screen.getByTestId("vc-prompt").textContent).toBe("標記你的感受");
  });

  it("顯示人數計數", () => {
    make({ state: withEntry });
    expect(screen.getByTestId("vc-count").textContent).toContain("1");
  });

  it("顯示每個維度的滑桿", () => {
    make();
    expect(screen.getByTestId("vc-dim-energy")).toBeTruthy();
    expect(screen.getByTestId("vc-slider-energy")).toBeTruthy();
    expect(screen.getByTestId("vc-dim-focus")).toBeTruthy();
    expect(screen.getByTestId("vc-slider-focus")).toBeTruthy();
  });

  it("顯示送出按鈕", () => {
    make();
    expect(screen.getByTestId("vc-submit-btn")).toBeTruthy();
  });

  it("點擊送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.click(screen.getByTestId("vc-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交顯示 vc-my-entry", () => {
    make({ state: withEntry, userId: "u1" });
    expect(screen.getByTestId("vc-my-entry")).toBeTruthy();
  });

  it("隊長看到 reveal 按鈕", () => {
    make({ state: withEntry, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("vc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: withEntry, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("vc-reveal-btn")).toBeNull();
  });

  it("revealed 顯示每個維度平均值", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("vc-result")).toBeTruthy();
    expect(screen.getByTestId("vc-avg-energy")).toBeTruthy();
    expect(screen.getByTestId("vc-avg-focus")).toBeTruthy();
  });

  it("loading 顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
