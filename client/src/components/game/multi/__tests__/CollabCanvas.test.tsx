import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollabCanvas } from "../CollabCanvas";
import type { CollabCanvasConfig, CollabCanvasState } from "../CollabCanvas";

const cfg: CollabCanvasConfig = {
  title: "協作畫布",
  prompt: "貼便利貼",
  zones: ["Keep", "Drop"],
  maxPerUser: 3,
  maxLength: 40,
};

const emptyState: CollabCanvasState = { notes: [], revealed: false };

const withNotes: CollabCanvasState = {
  notes: [
    { noteId: "n1", userId: "u1", userName: "Alice", zone: "Keep", content: "好的流程", color: "#FDE68A" },
    { noteId: "n2", userId: "u2", userName: "Bob", zone: "Drop", content: "多餘會議", color: "#BBF7D0" },
  ],
  revealed: false,
};

const revealedState: CollabCanvasState = { ...withNotes, revealed: true };

function make(overrides: Partial<Parameters<typeof CollabCanvas>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onAddNote: vi.fn(),
    onReveal: vi.fn(),
  };
  return render(<CollabCanvas {...defaults} {...overrides} />);
}

describe("CollabCanvas", () => {
  it("顯示標題與提示", () => {
    make();
    expect(screen.getByTestId("cc-title").textContent).toBe("協作畫布");
    expect(screen.getByTestId("cc-prompt").textContent).toBe("貼便利貼");
  });

  it("顯示便利貼計數", () => {
    make({ state: withNotes });
    expect(screen.getByTestId("cc-count").textContent).toContain("2");
  });

  it("顯示區域選擇器", () => {
    make();
    expect(screen.getByTestId("cc-zone-select")).toBeTruthy();
    expect(screen.getByTestId("cc-zone-btn-Keep")).toBeTruthy();
    expect(screen.getByTestId("cc-zone-btn-Drop")).toBeTruthy();
  });

  it("選擇區域後可輸入並送出", () => {
    const onAddNote = vi.fn();
    make({ onAddNote });
    fireEvent.click(screen.getByTestId("cc-zone-btn-Keep"));
    fireEvent.change(screen.getByTestId("cc-input"), { target: { value: "好的流程" } });
    fireEvent.click(screen.getByTestId("cc-add-btn"));
    expect(onAddNote).toHaveBeenCalledWith("Keep", "好的流程");
  });

  it("尚未選區域時 add 按鈕禁用", () => {
    make();
    fireEvent.change(screen.getByTestId("cc-input"), { target: { value: "某內容" } });
    const btn = screen.getByTestId("cc-add-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("已有我的便利貼顯示 cc-my-notes", () => {
    make({ state: withNotes, userId: "u1" });
    expect(screen.getByTestId("cc-my-notes")).toBeTruthy();
  });

  it("隊長看到 reveal 按鈕", () => {
    make({ state: withNotes, isTeamLead: true, userId: "u999" });
    expect(screen.getByTestId("cc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到 reveal 按鈕", () => {
    make({ state: withNotes, isTeamLead: false, userId: "u999" });
    expect(screen.queryByTestId("cc-reveal-btn")).toBeNull();
  });

  it("revealed 顯示各區域便利貼", () => {
    make({ state: revealedState });
    expect(screen.getByTestId("cc-result")).toBeTruthy();
    expect(screen.getByTestId("cc-zone-Keep")).toBeTruthy();
    expect(screen.getByTestId("cc-zone-Drop")).toBeTruthy();
    expect(screen.getByTestId("cc-note-n1")).toBeTruthy();
    expect(screen.getByTestId("cc-note-n2")).toBeTruthy();
  });

  it("loading 顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
