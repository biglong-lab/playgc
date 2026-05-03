import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BingoBoard, { computeLines, type BingoTask } from "../BingoBoard";

const tasks25: BingoTask[] = Array.from({ length: 25 }, (_, i) => ({
  id: `t-${i}`,
  label: `任務 ${i}`,
}));

describe("BingoBoard.computeLines", () => {
  it("5×5 共 12 條線（5 橫 + 5 直 + 2 斜）", () => {
    const lines = computeLines(5, 5);
    expect(lines).toHaveLength(12);
    expect(lines.filter((l) => l.id.startsWith("row-"))).toHaveLength(5);
    expect(lines.filter((l) => l.id.startsWith("col-"))).toHaveLength(5);
    expect(lines.filter((l) => l.id.startsWith("diag-"))).toHaveLength(2);
  });

  it("3×3 共 8 條線（3 橫 + 3 直 + 2 斜）", () => {
    const lines = computeLines(3, 3);
    expect(lines).toHaveLength(8);
  });

  it("非方陣（5×4）無斜線", () => {
    const lines = computeLines(5, 4);
    expect(lines.filter((l) => l.id.startsWith("diag-"))).toHaveLength(0);
    expect(lines).toHaveLength(9); // 5 橫 + 4 直
  });

  it("橫線 cells 對齊 row index", () => {
    const lines = computeLines(5, 5);
    const row2 = lines.find((l) => l.id === "row-2");
    expect(row2?.cells).toEqual([10, 11, 12, 13, 14]);
  });

  it("斜線 tl-br 對角線", () => {
    const lines = computeLines(5, 5);
    const diag = lines.find((l) => l.id === "diag-tl-br");
    expect(diag?.cells).toEqual([0, 6, 12, 18, 24]);
  });
});

describe("BingoBoard hostMode（大螢幕）", () => {
  it("顯示標題與 5×5 grid", () => {
    render(
      <BingoBoard
        config={{ title: "園遊會 Bingo", tasks: tasks25 }}
        hostMode={true}
        state={{ completed: {}, claimedLines: [], totalParticipants: 0 }}
      />,
    );
    expect(screen.getByText("園遊會 Bingo")).toBeInTheDocument();
    expect(screen.getByTestId("bingo-grid")).toBeInTheDocument();
    expect(screen.getByTestId("bingo-cell-0")).toBeInTheDocument();
    expect(screen.getByTestId("bingo-cell-24")).toBeInTheDocument();
  });

  it("顯示完成計數 + 連線數", () => {
    render(
      <BingoBoard
        config={{ title: "Bingo", tasks: tasks25 }}
        hostMode={true}
        state={{
          completed: { "t-0": 1, "t-1": 1, "t-2": 1, "t-3": 1, "t-4": 1 },
          claimedLines: ["row-0"],
          totalParticipants: 5,
        }}
      />,
    );
    expect(screen.getByText("5/25")).toBeInTheDocument();
    // 連線數 1 應該顯示
    expect(screen.getByText("🎉 達成 1 條連線！")).toBeInTheDocument();
  });

  it("requiredCount > 1 時 cell 顯示進度", () => {
    const tasks: BingoTask[] = [{ id: "t-0", label: "集 3 個", requiredCount: 3 }];
    while (tasks.length < 25) tasks.push({ id: `t-${tasks.length}`, label: "" });

    render(
      <BingoBoard
        config={{ tasks }}
        hostMode={true}
        state={{ completed: { "t-0": 2 }, claimedLines: [], totalParticipants: 1 }}
      />,
    );
    // 進度 2/3 應該出現
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("達 requiredCount 時顯示打勾", () => {
    const tasks: BingoTask[] = [{ id: "t-0", label: "完成", requiredCount: 2 }];
    while (tasks.length < 25) tasks.push({ id: `t-${tasks.length}`, label: "" });

    const { container } = render(
      <BingoBoard
        config={{ tasks }}
        hostMode={true}
        state={{ completed: { "t-0": 2 }, claimedLines: [], totalParticipants: 1 }}
      />,
    );
    // cell-0 應該包含 ✓
    const cell = container.querySelector('[data-testid="bingo-cell-0"]');
    expect(cell?.textContent).toContain("✓");
  });
});

describe("BingoBoard 玩家端（手機）", () => {
  const fewTasks: BingoTask[] = [
    { id: "t-1", label: "任務一", emoji: "🎯" },
    { id: "t-2", label: "任務二", requiredCount: 3 },
    { id: "t-3", label: "已完成", emoji: "✅" },
  ];

  it("顯示所有任務按鈕", () => {
    render(<BingoBoard config={{ tasks: fewTasks }} hostMode={false} />);
    expect(screen.getByTestId("bingo-task-t-1")).toBeInTheDocument();
    expect(screen.getByTestId("bingo-task-t-2")).toBeInTheDocument();
    expect(screen.getByTestId("bingo-task-t-3")).toBeInTheDocument();
  });

  it("點任務按鈕觸發 onPulse(task_complete, { taskId })", () => {
    const onPulse = vi.fn();
    render(<BingoBoard config={{ tasks: fewTasks }} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("bingo-task-t-1"));
    expect(onPulse).toHaveBeenCalledWith("task_complete", { taskId: "t-1" });
  });

  it("已完成任務按鈕 disabled 不再觸發 pulse", () => {
    const onPulse = vi.fn();
    render(
      <BingoBoard
        config={{ tasks: fewTasks }}
        hostMode={false}
        state={{ completed: { "t-3": 1 }, claimedLines: [], totalParticipants: 1 }}
        onPulse={onPulse}
      />,
    );
    const btn = screen.getByTestId("bingo-task-t-3") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onPulse).not.toHaveBeenCalled();
  });

  it("requiredCount > 1 顯示進度 N/M", () => {
    render(
      <BingoBoard
        config={{ tasks: fewTasks }}
        hostMode={false}
        state={{ completed: { "t-2": 1 }, claimedLines: [], totalParticipants: 1 }}
      />,
    );
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("沒 state 時 fallback 不 crash", () => {
    render(<BingoBoard config={{ tasks: fewTasks }} hostMode={false} />);
    // 應該安全顯示「點擊完成」
    expect(screen.getAllByText("點擊完成").length).toBeGreaterThan(0);
  });
});
