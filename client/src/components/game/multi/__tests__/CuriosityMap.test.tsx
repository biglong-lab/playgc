import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CuriosityMap } from "../CuriosityMap";
import type { CuriosityMapConfig, CuriosityMapState } from "../CuriosityMap";

const cfg: CuriosityMapConfig = {
  title: "好奇心地圖",
  prompt: "你的好奇心是什麼？",
  placeholder: "輸入問題",
  maxLength: 80,
};

const emptyState: CuriosityMapState = { entries: [], revealed: false };

const withEntry: CuriosityMapState = {
  entries: [{ entryId: "e1", userId: "u1", userName: "Alice", question: "宇宙有多大？" }],
  revealed: false,
};

const revealedState: CuriosityMapState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", question: "宇宙有多大？" },
    { entryId: "e2", userId: "u2", userName: "Bob", question: "時間是什麼？" },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof CuriosityMap>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<CuriosityMap {...defaults} {...overrides} />);
}

describe("CuriosityMap", () => {
  it("顯示標題與提示", () => {
    make();
    expect(screen.getByTestId("cm-title").textContent).toBe("好奇心地圖");
    expect(screen.getByTestId("cm-prompt").textContent).toBe("你的好奇心是什麼？");
  });

  it("顯示計數", () => {
    make({ state: withEntry });
    expect(screen.getByTestId("cm-count").textContent).toContain("1");
  });

  it("顯示輸入框", () => {
    make();
    expect(screen.getByTestId("cm-input")).toBeTruthy();
    expect(screen.getByTestId("cm-submit-btn")).toBeTruthy();
  });

  it("空白時送出按鈕禁用", () => {
    make();
    const btn = screen.getByTestId("cm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入後可送出", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.change(screen.getByTestId("cm-input"), { target: { value: "宇宙有多大？" } });
    fireEvent.click(screen.getByTestId("cm-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("宇宙有多大？");
  });

  it("已提交顯示 cm-my-entry", () => {
    make({ state: withEntry, userId: "u1" });
    expect(screen.getByTestId("cm-my-entry")).toBeTruthy();
  });

  it("隊長看到 reveal 按鈕", () => {
    make({ state: withEntry, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("cm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: withEntry, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("cm-reveal-btn")).toBeNull();
  });

  it("revealed 顯示所有條目", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("cm-result")).toBeTruthy();
    expect(screen.getByTestId("cm-entry-e1")).toBeTruthy();
    expect(screen.getByTestId("cm-entry-e2")).toBeTruthy();
  });

  it("loading 顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
