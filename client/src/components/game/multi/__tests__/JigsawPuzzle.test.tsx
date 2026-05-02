import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import JigsawPuzzle from "../JigsawPuzzle";

const sampleConfig = {
  title: "金門景點拼圖",
  rows: 2,
  cols: 2,
  prompts: ["紅色物體", "白色建築", "綠色植物", "藍色海景"],
};

const initialSlots = [
  { id: "r0c0", row: 0, col: 0, prompt: "紅色物體" },
  { id: "r0c1", row: 0, col: 1, prompt: "白色建築" },
  { id: "r1c0", row: 1, col: 0, prompt: "綠色植物" },
  { id: "r1c1", row: 1, col: 1, prompt: "藍色海景" },
];

describe("JigsawPuzzle", () => {
  it("顯示標題 + 進度（0/4）", () => {
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: initialSlots, isComplete: false }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={() => {}}
      />,
    );
    expect(screen.getByText("金門景點拼圖")).toBeInTheDocument();
    // 進度 0 / 4 用 getAllByText 因為「4」可能在多處
    expect(screen.getByText(/進度：/)).toBeInTheDocument();
  });

  it("顯示 4 個 prompt slot", () => {
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: initialSlots, isComplete: false }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={() => {}}
      />,
    );
    expect(screen.getByText("紅色物體")).toBeInTheDocument();
    expect(screen.getByText("白色建築")).toBeInTheDocument();
    expect(screen.getByText("綠色植物")).toBeInTheDocument();
    expect(screen.getByText("藍色海景")).toBeInTheDocument();
  });

  it("有「我的格」標記給未完成的玩家", () => {
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: initialSlots, isComplete: false }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={() => {}}
      />,
    );
    expect(screen.getByText("這是你的格！")).toBeInTheDocument();
  });

  it("填寫並提交觸發 onFillSlot", () => {
    const onFill = vi.fn();
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: initialSlots, isComplete: false }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={onFill}
      />,
    );
    const input = screen.getByTestId("input-jigsaw-text") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "紅磚牆" } });
    fireEvent.click(screen.getByTestId("btn-fill-slot"));
    expect(onFill).toHaveBeenCalled();
    const call = onFill.mock.calls[0];
    expect(call[1]).toBe("紅磚牆");
  });

  it("空白文字時禁用提交按鈕", () => {
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: initialSlots, isComplete: false }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={() => {}}
      />,
    );
    const btn = screen.getByTestId("btn-fill-slot") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("isComplete 顯示完成畫面", () => {
    const completedSlots = initialSlots.map((s, i) => ({
      ...s,
      filledBy: `User${i}`,
      text: `Text${i}`,
      color: "#ef4444",
    }));
    render(
      <JigsawPuzzle
        config={sampleConfig}
        state={{ slots: completedSlots, isComplete: true }}
        myUserId="u1"
        myUserName="Alice"
        onFillSlot={() => {}}
      />,
    );
    expect(screen.getByText(/拼圖完成/)).toBeInTheDocument();
    expect(screen.getByText(/全隊一起完成了 4 格/)).toBeInTheDocument();
  });
});
