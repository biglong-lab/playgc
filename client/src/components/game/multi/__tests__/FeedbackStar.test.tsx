import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FeedbackStar from "../FeedbackStar";
import type { FeedbackStarConfig, FeedbackStarState, FeedbackEntry } from "../FeedbackStar";

const config: FeedbackStarConfig = {
  title: "活動評分",
  question: "今天的活動如何？",
  allowComment: true,
};

const emptyState: FeedbackStarState = { entries: [] };

const makeEntry = (userId: string, stars: number, comment?: string): FeedbackEntry => ({
  userId, userName: userId === "u1" ? "Alice" : "Bob",
  stars, comment, submittedAt: Date.now(),
});

describe("FeedbackStar", () => {
  it("顯示標題", () => {
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-star-title")).toHaveTextContent("活動評分");
  });

  it("顯示 question", () => {
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("今天的活動如何？")).toBeInTheDocument();
  });

  it("顯示 5 顆星按鈕", () => {
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`star-btn-${i}`)).toBeInTheDocument();
    }
  });

  it("未選星時送出按鈕禁用", () => {
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    const btn = screen.getByTestId("feedback-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選了星後送出按鈕可用", () => {
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("star-btn-4"));
    const btn = screen.getByTestId("feedback-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點擊送出呼叫 onSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId("star-btn-5"));
    fireEvent.click(screen.getByTestId("feedback-submit-btn"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(5, undefined));
  });

  it("帶留言點擊送出", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FeedbackStar config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId("star-btn-4"));
    const textarea = screen.getByPlaceholderText("留下一句話（選填）");
    fireEvent.change(textarea, { target: { value: "很棒！" } });
    fireEvent.click(screen.getByTestId("feedback-submit-btn"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(4, "很棒！"));
  });

  it("已提交顯示感謝畫面", () => {
    const state: FeedbackStarState = { entries: [makeEntry("u1", 5, "很讚")] };
    render(
      <FeedbackStar config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-submitted")).toBeInTheDocument();
    expect(screen.getByText("感謝你的評分！")).toBeInTheDocument();
  });

  it("有評分後顯示統計", () => {
    const state: FeedbackStarState = { entries: [makeEntry("u1", 4), makeEntry("u2", 5)] };
    render(
      <FeedbackStar config={config} state={state} myUserId="u3" myUserName="Carol" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-stats")).toBeInTheDocument();
  });

  it("顯示平均分 badge", () => {
    const state: FeedbackStarState = { entries: [makeEntry("u2", 4), makeEntry("u3", 4)] };
    render(
      <FeedbackStar config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-avg")).toHaveTextContent("4.0");
  });

  it("有留言時顯示留言區", () => {
    const state: FeedbackStarState = { entries: [makeEntry("u2", 5, "太好玩了")] };
    render(
      <FeedbackStar config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-comments")).toBeInTheDocument();
    expect(screen.getByText("太好玩了")).toBeInTheDocument();
  });

  it("使用預設標題", () => {
    render(
      <FeedbackStar config={{}} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("feedback-star-title")).toHaveTextContent("⭐ 活動評分");
  });
});
