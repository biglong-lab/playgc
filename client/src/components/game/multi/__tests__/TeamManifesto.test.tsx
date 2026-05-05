import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamManifesto } from "../TeamManifesto";
import type { TeamManifestoConfig, TeamManifestoState } from "../TeamManifesto";

const cfg: TeamManifestoConfig = {
  title: "團隊宣言",
  stem: "我們是一個...",
  placeholder: "輸入關鍵詞",
  maxLength: 20,
  maxPerUser: 3,
};

const emptyState: TeamManifestoState = { entries: [], revealed: false };

const withEntries: TeamManifestoState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", phrase: "創新" },
    { entryId: "e2", userId: "u2", userName: "Bob", phrase: "團結" },
  ],
  revealed: false,
};

const revealedState: TeamManifestoState = {
  entries: [
    { entryId: "e1", userId: "u1", userName: "Alice", phrase: "創新" },
    { entryId: "e2", userId: "u2", userName: "Bob", phrase: "團結" },
  ],
  revealed: true,
};

function make(overrides: Partial<Parameters<typeof TeamManifesto>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<TeamManifesto {...defaults} {...overrides} />);
}

describe("TeamManifesto", () => {
  it("顯示標題與句子開頭", () => {
    make();
    expect(screen.getByTestId("tm-title").textContent).toBe("團隊宣言");
    expect(screen.getByTestId("tm-stem").textContent).toBe("我們是一個...");
  });

  it("顯示關鍵詞計數", () => {
    make({ state: withEntries });
    expect(screen.getByTestId("tm-count").textContent).toContain("2");
  });

  it("顯示輸入框", () => {
    make();
    expect(screen.getByTestId("tm-input")).toBeTruthy();
    expect(screen.getByTestId("tm-submit-btn")).toBeTruthy();
  });

  it("輸入後可點擊送出", () => {
    const onSubmit = vi.fn();
    make({ onSubmit });
    fireEvent.change(screen.getByTestId("tm-input"), { target: { value: "創新" } });
    fireEvent.click(screen.getByTestId("tm-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("創新");
  });

  it("我的條目顯示在 tm-my-entries", () => {
    make({ state: withEntries, userId: "u1" });
    expect(screen.getByTestId("tm-my-entries")).toBeTruthy();
  });

  it("隊長看到 reveal 按鈕", () => {
    make({ state: withEntries, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("tm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: withEntries, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("tm-reveal-btn")).toBeNull();
  });

  it("revealed 顯示所有條目", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("tm-result")).toBeTruthy();
    expect(screen.getByTestId("tm-entry-e1")).toBeTruthy();
    expect(screen.getByTestId("tm-entry-e2")).toBeTruthy();
  });

  it("revealed 空白時顯示 tm-empty", () => {
    make({ state: { entries: [], revealed: true } });
    expect(screen.getByTestId("tm-empty")).toBeTruthy();
  });

  it("loading 時顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
