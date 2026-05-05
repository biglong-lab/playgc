import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LuckyDraw from "../LuckyDraw";
import type { LuckyDrawConfig, LuckyDrawState, Participant, DrawResult } from "../LuckyDraw";

const defaultConfig: LuckyDrawConfig = {
  title: "🎰 年度抽獎",
  subtitle: "祝你好運！",
  prizes: [
    { id: "p1", name: "一等獎", emoji: "🏆", quantity: 1 },
    { id: "p2", name: "二等獎", emoji: "🎁", quantity: 2 },
  ],
};

const p1: Participant = { userId: "u1", userName: "Alice", joinedAt: Date.now() };
const p2: Participant = { userId: "u2", userName: "Bob", joinedAt: Date.now() };

const registerState: LuckyDrawState = {
  phase: "register",
  participants: [],
  results: [],
  hostUserId: null,
};

const drawingState = (participants = [p1, p2], results: DrawResult[] = [], host = "u1"): LuckyDrawState => ({
  phase: "drawing",
  participants,
  results,
  hostUserId: host,
});

const doneState: LuckyDrawState = {
  phase: "done",
  participants: [p1, p2],
  results: [
    { prizeId: "p1", prizeName: "一等獎", prizeEmoji: "🏆", winnerId: "u1", winnerName: "Alice", drawnAt: Date.now() },
  ],
  hostUserId: "u1",
};

const mockJoin = vi.fn(() => Promise.resolve());
const mockStart = vi.fn(() => Promise.resolve());
const mockDraw = vi.fn(() => Promise.resolve());
const mockFinish = vi.fn(() => Promise.resolve());

describe("LuckyDraw", () => {
  it("顯示標題", () => {
    render(<LuckyDraw config={defaultConfig} state={registerState} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("lucky-draw-title")).toHaveTextContent("年度抽獎");
  });

  it("顯示副標題", () => {
    render(<LuckyDraw config={defaultConfig} state={registerState} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("lucky-draw-subtitle")).toHaveTextContent("祝你好運");
  });

  it("register 顯示加入按鈕", () => {
    render(<LuckyDraw config={defaultConfig} state={registerState} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("join-btn")).toBeInTheDocument();
  });

  it("點擊加入呼叫 onJoin", async () => {
    const onJoin = vi.fn(() => Promise.resolve());
    render(<LuckyDraw config={defaultConfig} state={registerState} myUserId="u1" myUserName="Alice" onJoin={onJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    fireEvent.click(screen.getByTestId("join-btn"));
    await waitFor(() => expect(onJoin).toHaveBeenCalled());
  });

  it("已加入顯示等待訊息", () => {
    const joined: LuckyDrawState = { ...registerState, participants: [p1] };
    render(<LuckyDraw config={defaultConfig} state={joined} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("joined-msg")).toBeInTheDocument();
  });

  it("顯示參加人數", () => {
    const state: LuckyDrawState = { ...registerState, participants: [p1, p2] };
    render(<LuckyDraw config={defaultConfig} state={state} myUserId="u3" myUserName="Carol" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("participant-count")).toHaveTextContent("2");
  });

  it("點擊開始抽獎呼叫 onStartDraw", async () => {
    const onStart = vi.fn(() => Promise.resolve());
    const state: LuckyDrawState = { ...registerState, participants: [p1] };
    render(<LuckyDraw config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={onStart} onDraw={mockDraw} onFinish={mockFinish} />);
    fireEvent.click(screen.getByTestId("start-draw-btn"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
  });

  it("drawing phase host 看到抽獎按鈕", () => {
    render(<LuckyDraw config={defaultConfig} state={drawingState()} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("draw-btn-p1")).toBeInTheDocument();
    expect(screen.getByTestId("draw-btn-p2")).toBeInTheDocument();
  });

  it("點擊抽獎按鈕呼叫 onDraw", async () => {
    const onDraw = vi.fn(() => Promise.resolve());
    render(<LuckyDraw config={defaultConfig} state={drawingState()} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={onDraw} onFinish={mockFinish} />);
    fireEvent.click(screen.getByTestId("draw-btn-p1"));
    await waitFor(() => expect(onDraw).toHaveBeenCalledWith("p1"));
  });

  it("顯示抽獎進度", () => {
    const result: DrawResult = { prizeId: "p1", prizeName: "一等獎", prizeEmoji: "🏆", winnerId: "u1", winnerName: "Alice", drawnAt: Date.now() };
    render(<LuckyDraw config={defaultConfig} state={drawingState([p1, p2], [result])} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("draw-progress")).toHaveTextContent("已抽 1 / 3");
  });

  it("中獎者顯示恭喜訊息", () => {
    const result: DrawResult = { prizeId: "p1", prizeName: "一等獎", prizeEmoji: "🏆", winnerId: "u1", winnerName: "Alice", drawnAt: Date.now() };
    render(<LuckyDraw config={defaultConfig} state={drawingState([p1, p2], [result])} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("i-won-msg")).toBeInTheDocument();
  });

  it("非中獎者不顯示恭喜訊息", () => {
    const result: DrawResult = { prizeId: "p1", prizeName: "一等獎", prizeEmoji: "🏆", winnerId: "u2", winnerName: "Bob", drawnAt: Date.now() };
    render(<LuckyDraw config={defaultConfig} state={drawingState([p1, p2], [result])} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.queryByTestId("i-won-msg")).not.toBeInTheDocument();
  });

  it("done phase 顯示完成畫面", () => {
    render(<LuckyDraw config={defaultConfig} state={doneState} myUserId="u1" myUserName="Alice" onJoin={mockJoin} onStartDraw={mockStart} onDraw={mockDraw} onFinish={mockFinish} />);
    expect(screen.getByTestId("lucky-draw-done")).toBeInTheDocument();
    expect(screen.getByTestId("winner-card-p1")).toBeInTheDocument();
  });
});
