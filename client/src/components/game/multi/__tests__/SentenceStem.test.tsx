import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SentenceStem } from "../SentenceStem";
import type { SentenceStemConfig, SentenceStemState } from "../SentenceStem";

const cfg: SentenceStemConfig = {
  title: "句子接龍",
  stemText: "如果我能飛...",
  placeholder: "繼續句子",
  maxLength: 80,
};

const emptyState: SentenceStemState = { entries: [], revealed: false };

const stateWithEntry: SentenceStemState = {
  entries: [{ entryId: "e1", userId: "u1", userName: "Alice", completion: "我要去旅行" }],
  revealed: false,
};

const revealedState: SentenceStemState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", completion: "我要去旅行" },
    { entryId: "e2", userId: "u2", userName: "Bob", completion: "我要環遊世界" },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof SentenceStem>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<SentenceStem {...defaults} {...overrides} />);
}

describe("SentenceStem", () => {
  it("顯示標題與句子提示", () => {
    make();
    expect(screen.getByTestId("ss-title").textContent).toBe("句子接龍");
    expect(screen.getByTestId("ss-stem").textContent).toBe("如果我能飛...");
  });

  it("顯示人數計數", () => {
    make({ state: stateWithEntry });
    expect(screen.getByTestId("ss-count").textContent).toContain("1");
  });

  it("尚未提交時顯示輸入框與按鈕", () => {
    make();
    expect(screen.getByTestId("ss-input")).toBeTruthy();
    expect(screen.getByTestId("ss-submit-btn")).toBeTruthy();
  });

  it("送出按鈕初始為禁用", () => {
    make();
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入文字後啟用送出", () => {
    make();
    const input = screen.getByTestId("ss-input") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "我要去旅行" } });
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點擊送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.change(screen.getByTestId("ss-input"), { target: { value: "我要去旅行" } });
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("我要去旅行");
  });

  it("已提交時顯示 ss-my-entry", () => {
    make({ state: stateWithEntry, userId: "u1" });
    expect(screen.getByTestId("ss-my-entry")).toBeTruthy();
  });

  it("隊長可看到 reveal 按鈕", () => {
    make({ state: stateWithEntry, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("ss-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: stateWithEntry, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("ss-reveal-btn")).toBeNull();
  });

  it("revealed 狀態顯示所有答案", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("ss-result")).toBeTruthy();
    expect(screen.getByTestId("ss-entry-e1")).toBeTruthy();
    expect(screen.getByTestId("ss-entry-e2")).toBeTruthy();
  });

  it("loading 時顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
