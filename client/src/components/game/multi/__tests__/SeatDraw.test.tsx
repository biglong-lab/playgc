import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SeatDraw from "../SeatDraw";
import type { SeatDrawConfig, SeatDrawState, DrawResult } from "../SeatDraw";

const defaultConfig: SeatDrawConfig = {
  title: "🎲 分組抽籤",
  subtitle: "點擊按鈕抽出你的組別",
  slots: [
    { id: "g1", label: "A 組", emoji: "🔵" },
    { id: "g2", label: "B 組", emoji: "🔴" },
    { id: "g3", label: "C 組", emoji: "🟢" },
  ],
  shuffleText: "我要抽！",
};

const emptyState: SeatDrawState = { results: [], pool: ["g1", "g2", "g3"] };
const mockOnDraw = vi.fn(() => Promise.resolve());

const makeResult = (userId: string, slotId: string): DrawResult => ({
  userId,
  userName: `user-${userId}`,
  slotId,
  drawnAt: Date.now(),
});

describe("SeatDraw", () => {
  it("顯示標題", () => {
    render(<SeatDraw config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("seat-draw-title")).toHaveTextContent("分組抽籤");
  });

  it("顯示副標題", () => {
    render(<SeatDraw config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-subtitle")).toHaveTextContent("點擊按鈕抽出你的組別");
  });

  it("顯示進度 0/3", () => {
    render(<SeatDraw config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-progress")).toHaveTextContent("0/3");
  });

  it("顯示抽籤按鈕", () => {
    render(<SeatDraw config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-btn")).toBeInTheDocument();
  });

  it("點擊抽籤按鈕呼叫 onDraw", async () => {
    const onDraw = vi.fn(() => Promise.resolve());
    render(<SeatDraw config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onDraw={onDraw} />);
    fireEvent.click(screen.getByTestId("draw-btn"));
    await waitFor(() => {
      expect(onDraw).toHaveBeenCalledOnce();
    });
  });

  it("已抽籤時顯示抽籤結果", () => {
    const state: SeatDrawState = {
      results: [makeResult("u1", "g1")],
      pool: ["g2", "g3"],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-result")).toBeInTheDocument();
    expect(screen.getByTestId("draw-result-label")).toHaveTextContent("A 組");
  });

  it("已抽籤時顯示 emoji", () => {
    const state: SeatDrawState = {
      results: [makeResult("u1", "g2")],
      pool: ["g1", "g3"],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-result-emoji")).toHaveTextContent("🔴");
  });

  it("已抽籤時不顯示抽籤按鈕", () => {
    const state: SeatDrawState = {
      results: [makeResult("u1", "g1")],
      pool: ["g2", "g3"],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.queryByTestId("draw-btn")).not.toBeInTheDocument();
  });

  it("進度更新（1/3）", () => {
    const state: SeatDrawState = {
      results: [makeResult("u2", "g1")],
      pool: ["g2", "g3"],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-progress")).toHaveTextContent("1/3");
  });

  it("顯示所有已抽籤的人員清單", () => {
    const state: SeatDrawState = {
      results: [makeResult("u2", "g1"), makeResult("u3", "g2")],
      pool: ["g3"],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-row-u2")).toBeInTheDocument();
    expect(screen.getByTestId("draw-row-u3")).toBeInTheDocument();
  });

  it("籤全部抽完時按鈕停用", () => {
    const state: SeatDrawState = {
      results: [makeResult("u2", "g1"), makeResult("u3", "g2"), makeResult("u4", "g3")],
      pool: [],
    };
    render(<SeatDraw config={defaultConfig} state={state} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.getByTestId("draw-btn")).toBeDisabled();
  });

  it("無副標題時不顯示", () => {
    const cfg = { ...defaultConfig, subtitle: undefined };
    render(<SeatDraw config={cfg} state={emptyState} myUserId="u1" myUserName="我" onDraw={mockOnDraw} />);
    expect(screen.queryByTestId("draw-subtitle")).not.toBeInTheDocument();
  });
});
