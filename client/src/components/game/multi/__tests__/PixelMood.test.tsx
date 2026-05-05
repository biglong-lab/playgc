import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PixelMood } from "../PixelMood";
import type { PixelMoodConfig, PixelMoodState } from "../PixelMood";

const cfg: PixelMoodConfig = {
  title: "心情馬賽克",
  prompt: "選一個心情",
  moods: [
    { id: "happy", emoji: "😊", label: "開心", color: "#FFD700" },
    { id: "calm", emoji: "😌", label: "平靜", color: "#4ECDC4" },
  ],
};

const emptyState: PixelMoodState = { entries: [], revealed: false };

const stateWithEntry: PixelMoodState = {
  entries: [{ entryId: "e1", userId: "u1", userName: "Alice", moodId: "happy" }],
  revealed: false,
};

const revealedState: PixelMoodState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", moodId: "happy" },
    { entryId: "e2", userId: "u2", userName: "Bob", moodId: "calm" },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof PixelMood>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<PixelMood {...defaults} {...overrides} />);
}

describe("PixelMood", () => {
  it("顯示標題與提示", () => {
    make();
    expect(screen.getByTestId("pm-title").textContent).toBe("心情馬賽克");
    expect(screen.getByTestId("pm-prompt").textContent).toBe("選一個心情");
  });

  it("顯示人數計數", () => {
    make({ state: stateWithEntry });
    expect(screen.getByTestId("pm-count").textContent).toContain("1");
  });

  it("未提交時顯示心情格子", () => {
    make();
    expect(screen.getByTestId("pm-mood-grid")).toBeTruthy();
    expect(screen.getByTestId("pm-mood-happy")).toBeTruthy();
    expect(screen.getByTestId("pm-mood-calm")).toBeTruthy();
  });

  it("點選心情呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.click(screen.getByTestId("pm-mood-happy"));
    expect(onSubmit).toHaveBeenCalledWith("happy");
  });

  it("已提交時顯示 pm-my-entry", () => {
    make({ state: stateWithEntry, userId: "u1" });
    expect(screen.getByTestId("pm-my-entry")).toBeTruthy();
  });

  it("隊長可看到 reveal 按鈕", () => {
    make({ state: stateWithEntry, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("pm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: stateWithEntry, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("pm-reveal-btn")).toBeNull();
  });

  it("revealed 狀態顯示像素格與統計", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("pm-result")).toBeTruthy();
    expect(screen.getByTestId("pm-pixel-e1")).toBeTruthy();
    expect(screen.getByTestId("pm-pixel-e2")).toBeTruthy();
  });

  it("revealed 顯示各心情統計", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("pm-tally-happy").textContent).toContain("1");
    expect(screen.getByTestId("pm-tally-calm").textContent).toContain("1");
  });

  it("loading 時顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
