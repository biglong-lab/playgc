import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MemoryMatchPage, {
  shuffleCards,
  isAllMatched,
  getTotalCards,
} from "../MemoryMatchPage";

describe("MemoryMatch", () => {
  it("shuffleCards 生成偶數張、每個 emoji 兩張", () => {
    const cards = shuffleCards(["A", "B", "C", "D"], 8, 12345);
    expect(cards.length).toBe(8);
    const emojiCounts = cards.reduce<Record<string, number>>((acc, c) => {
      acc[c.emoji] = (acc[c.emoji] ?? 0) + 1;
      return acc;
    }, {});
    expect(emojiCounts.A).toBe(2);
    expect(emojiCounts.B).toBe(2);
    expect(emojiCounts.C).toBe(2);
    expect(emojiCounts.D).toBe(2);
  });

  it("shuffleCards 同樣 seed 產生相同順序（確定性）", () => {
    const cards1 = shuffleCards(["A", "B", "C", "D"], 8, 99);
    const cards2 = shuffleCards(["A", "B", "C", "D"], 8, 99);
    expect(cards1.map((c) => c.emoji)).toEqual(cards2.map((c) => c.emoji));
  });

  it("shuffleCards 不同 seed 產生不同順序", () => {
    const cards1 = shuffleCards(["A", "B", "C", "D", "E", "F", "G", "H"], 16, 1);
    const cards2 = shuffleCards(["A", "B", "C", "D", "E", "F", "G", "H"], 16, 9999);
    expect(cards1.map((c) => c.emoji)).not.toEqual(cards2.map((c) => c.emoji));
  });

  it("shuffleCards 初始狀態 flipped=false / matched=false", () => {
    const cards = shuffleCards(["A", "B"], 4);
    cards.forEach((c) => {
      expect(c.flipped).toBe(false);
      expect(c.matched).toBe(false);
    });
  });

  it("isAllMatched 全部 matched=true 才回 true", () => {
    expect(isAllMatched([])).toBe(false);
    expect(
      isAllMatched([
        { id: "1", emoji: "A", flipped: true, matched: true },
        { id: "2", emoji: "A", flipped: true, matched: false },
      ]),
    ).toBe(false);
    expect(
      isAllMatched([
        { id: "1", emoji: "A", flipped: true, matched: true },
        { id: "2", emoji: "A", flipped: true, matched: true },
      ]),
    ).toBe(true);
  });

  it("getTotalCards 4x4=16 / 6x6=36", () => {
    expect(getTotalCards("4x4")).toBe(16);
    expect(getTotalCards("6x6")).toBe(36);
  });

  it("頁面渲染顯示標題 + 棋盤 + 計數", () => {
    render(
      <MemoryMatchPage
        config={{ title: "金門記憶", size: "4x4" }}
        onComplete={vi.fn()}
        sessionId="test"
      />,
    );
    expect(screen.getByText(/金門記憶/)).toBeInTheDocument();
    expect(screen.getByTestId("memory-board")).toBeInTheDocument();
    // 16 張卡片
    for (let i = 0; i < 16; i++) {
      expect(screen.getByTestId(`memory-card-${i}`)).toBeInTheDocument();
    }
  });

  it("頁面預設 4x4 棋盤（16 張）", () => {
    render(
      <MemoryMatchPage config={{}} onComplete={vi.fn()} sessionId="test" />,
    );
    expect(screen.getByTestId("memory-card-15")).toBeInTheDocument();
    expect(screen.queryByTestId("memory-card-16")).not.toBeInTheDocument();
  });

  it("size=6x6 顯示 36 張卡片", () => {
    render(
      <MemoryMatchPage
        config={{ size: "6x6" }}
        onComplete={vi.fn()}
        sessionId="test"
      />,
    );
    expect(screen.getByTestId("memory-card-35")).toBeInTheDocument();
    expect(screen.queryByTestId("memory-card-36")).not.toBeInTheDocument();
  });

  it("preview 期間棋盤顯示 emoji 後翻回去", () => {
    vi.useFakeTimers();
    render(
      <MemoryMatchPage
        config={{ size: "4x4", showFirstNSeconds: 3 }}
        onComplete={vi.fn()}
        sessionId="test"
      />,
    );
    expect(screen.getByText(/記住卡片位置/)).toBeInTheDocument();
    // 過 3.1 秒
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    // preview 應結束
    expect(screen.queryByText(/記住卡片位置/)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
