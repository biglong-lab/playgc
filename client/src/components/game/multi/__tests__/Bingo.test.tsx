import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Bingo from "../Bingo";
import type { BingoConfig, BingoState } from "../Bingo";

const config3x3: BingoConfig = {
  title: "破冰賓果",
  subtitle: "找到符合描述的隊友",
  items: ["去過日本", "有養寵物", "是長子女", "喜歡咖啡", "會騎機車", "喜歡唱歌", "有學過樂器", "最近看過電影", "喜歡健行"],
  gridSize: 3,
  winCondition: "line",
};

const emptyState: BingoState = { markedItems: [], isWon: false };

describe("Bingo", () => {
  it("顯示標題與進度 badge", () => {
    render(<Bingo config={config3x3} state={emptyState} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("破冰賓果")).toBeInTheDocument();
    expect(screen.getByText("0/9")).toBeInTheDocument();
  });

  it("顯示 subtitle", () => {
    render(<Bingo config={config3x3} state={emptyState} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("找到符合描述的隊友")).toBeInTheDocument();
  });

  it("顯示所有 9 個格子", () => {
    render(<Bingo config={config3x3} state={emptyState} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("去過日本")).toBeInTheDocument();
    expect(screen.getByText("有養寵物")).toBeInTheDocument();
    expect(screen.getByText("喜歡健行")).toBeInTheDocument();
  });

  it("點擊格子呼叫 onMark", () => {
    const onMark = vi.fn().mockResolvedValue(undefined);
    render(<Bingo config={config3x3} state={emptyState} myUserName="Alice" onMark={onMark} />);
    fireEvent.click(screen.getByText("去過日本"));
    expect(onMark).toHaveBeenCalledWith("去過日本");
  });

  it("已標記的格子顯示 ✓ 且 disabled", () => {
    const state: BingoState = { markedItems: ["去過日本"], isWon: false };
    render(<Bingo config={config3x3} state={state} myUserName="Alice" onMark={vi.fn()} />);
    const markedBtn = screen.getAllByRole("button").find((b) => b.textContent === "✓");
    expect(markedBtn).toBeDefined();
    expect((markedBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("已標記項目顯示在清單", () => {
    const state: BingoState = { markedItems: ["去過日本", "有養寵物"], isWon: false };
    render(<Bingo config={config3x3} state={state} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("已標記：")).toBeInTheDocument();
    // badge 形式顯示，直接取所有 badge 文字
    const items = screen.getAllByText("去過日本");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("isWon=true 顯示慶祝畫面", () => {
    const state: BingoState = { markedItems: ["去過日本"], isWon: true };
    render(<Bingo config={config3x3} state={state} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("BINGO！")).toBeInTheDocument();
    expect(screen.getByText("恭喜達成賓果！")).toBeInTheDocument();
  });

  it("isWon=true 時自定義慶祝文字", () => {
    const cfg: BingoConfig = { ...config3x3, celebrationText: "太棒了！全隊達成！" };
    const state: BingoState = { markedItems: [], isWon: true };
    render(<Bingo config={cfg} state={state} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("太棒了！全隊達成！")).toBeInTheDocument();
  });

  it("連線自動偵測 win — 橫向第一行", () => {
    // 標記前三項（第一行），雖然 isWon=false 但 checkWin 應偵測
    const state: BingoState = { markedItems: ["去過日本", "有養寵物", "是長子女"], isWon: false };
    render(<Bingo config={config3x3} state={state} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("BINGO！")).toBeInTheDocument();
  });

  it("使用預設 title", () => {
    const cfg: BingoConfig = { items: config3x3.items };
    render(<Bingo config={cfg} state={emptyState} myUserName="Alice" onMark={vi.fn()} />);
    expect(screen.getByText("🎱 賓果")).toBeInTheDocument();
  });
});
