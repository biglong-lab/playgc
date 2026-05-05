import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RatingWall from "../RatingWall";
import type { RatingWallConfig, RatingWallState, RatingEntry } from "../RatingWall";

const defaultConfig: RatingWallConfig = {
  title: "⭐ Demo Day 評分",
  subtitle: "為每組作品評分",
  items: [
    { id: "i1", label: "第一組：智慧農業", emoji: "🌱" },
    { id: "i2", label: "第二組：城市微旅行", emoji: "🏙️" },
  ],
  maxStars: 5,
  showResults: true,
};

const emptyState: RatingWallState = { ratings: [] };
const mockOnRate = vi.fn(() => Promise.resolve());

const makeRating = (userId: string, itemId: string, stars: number): RatingEntry => ({
  userId,
  itemId,
  stars,
  ratedAt: Date.now(),
});

describe("RatingWall", () => {
  it("顯示標題", () => {
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rating-wall-title")).toHaveTextContent("Demo Day 評分");
  });

  it("顯示副標題", () => {
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rating-subtitle")).toHaveTextContent("為每組作品評分");
  });

  it("顯示所有項目", () => {
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rating-item-i1")).toBeInTheDocument();
    expect(screen.getByTestId("rating-item-i2")).toBeInTheDocument();
  });

  it("每個項目顯示 5 顆星按鈕", () => {
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rate-star-i1-1")).toBeInTheDocument();
    expect(screen.getByTestId("rate-star-i1-5")).toBeInTheDocument();
  });

  it("點擊星星呼叫 onRate", async () => {
    const onRate = vi.fn(() => Promise.resolve());
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={onRate} />);
    fireEvent.click(screen.getByTestId("rate-star-i1-4"));
    await waitFor(() => {
      expect(onRate).toHaveBeenCalledWith("i1", 4);
    });
  });

  it("進度顯示 0/2 已評", () => {
    render(<RatingWall config={defaultConfig} state={emptyState} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rating-progress")).toHaveTextContent("0/2 已評");
  });

  it("已評項目顯示勾選標記", () => {
    const state: RatingWallState = { ratings: [makeRating("u1", "i1", 4)] };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rated-badge-i1")).toBeInTheDocument();
  });

  it("已評項目星星停用", () => {
    const state: RatingWallState = { ratings: [makeRating("u1", "i1", 3)] };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rate-star-i1-1")).toBeDisabled();
    expect(screen.getByTestId("rate-star-i1-5")).toBeDisabled();
  });

  it("顯示平均分數", () => {
    const state: RatingWallState = {
      ratings: [makeRating("u1", "i1", 4), makeRating("u2", "i1", 2)],
    };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("avg-score-i1")).toHaveTextContent("3.0");
  });

  it("顯示評分人數", () => {
    const state: RatingWallState = {
      ratings: [makeRating("u1", "i1", 5), makeRating("u2", "i1", 4), makeRating("u3", "i1", 3)],
    };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u4" onRate={mockOnRate} />);
    expect(screen.getByTestId("rate-count-i1")).toHaveTextContent("3 票");
  });

  it("全部評完後顯示完成訊息", () => {
    const state: RatingWallState = {
      ratings: [makeRating("u1", "i1", 4), makeRating("u1", "i2", 5)],
    };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.getByTestId("rating-complete-msg")).toBeInTheDocument();
  });

  it("未全部評完不顯示完成訊息", () => {
    const state: RatingWallState = { ratings: [makeRating("u1", "i1", 4)] };
    render(<RatingWall config={defaultConfig} state={state} myUserId="u1" onRate={mockOnRate} />);
    expect(screen.queryByTestId("rating-complete-msg")).not.toBeInTheDocument();
  });
});
