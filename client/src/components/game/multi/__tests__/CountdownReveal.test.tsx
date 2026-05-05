import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CountdownReveal from "../CountdownReveal";
import type { CountdownRevealConfig, CountdownRevealState } from "../CountdownReveal";

const defaultConfig: CountdownRevealConfig = {
  title: "🏆 年度大獎揭曉",
  revealText: "最佳員工：張小明",
  revealEmoji: "🏆",
  durationSeconds: 3,
  suspenseMessage: "緊張嗎？倒數即將開始！",
};

const idleState: CountdownRevealState = { startedAt: null, startedBy: null };
const mockOnStart = vi.fn(() => Promise.resolve());

describe("CountdownReveal", () => {
  it("顯示標題", () => {
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByTestId("countdown-title")).toHaveTextContent("年度大獎揭曉");
  });

  it("未開始時顯示懸念訊息", () => {
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByText("緊張嗎？倒數即將開始！")).toBeInTheDocument();
  });

  it("isHost=true 顯示開始按鈕", () => {
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" isHost={true} onStart={mockOnStart} />);
    expect(screen.getByTestId("countdown-start-btn")).toBeInTheDocument();
  });

  it("isHost=false 不顯示開始按鈕", () => {
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" isHost={false} onStart={mockOnStart} />);
    expect(screen.queryByTestId("countdown-start-btn")).not.toBeInTheDocument();
  });

  it("點擊開始按鈕呼叫 onStart", async () => {
    const onStart = vi.fn(() => Promise.resolve());
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" isHost={true} onStart={onStart} />);
    fireEvent.click(screen.getByTestId("countdown-start-btn"));
    await waitFor(() => {
      expect(onStart).toHaveBeenCalledOnce();
    });
  });

  it("倒數進行中顯示倒數數字", () => {
    const startedAt = Date.now() - 500;
    const state: CountdownRevealState = { startedAt, startedBy: "u1" };
    render(<CountdownReveal config={defaultConfig} state={state} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByTestId("countdown-active")).toBeInTheDocument();
    expect(screen.getByTestId("countdown-number")).toBeInTheDocument();
  });

  it("倒數完成後顯示揭曉內容", () => {
    const startedAt = Date.now() - 5000;
    const state: CountdownRevealState = { startedAt, startedBy: "u1" };
    render(<CountdownReveal config={defaultConfig} state={state} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByTestId("countdown-revealed")).toBeInTheDocument();
    expect(screen.getByTestId("reveal-text")).toHaveTextContent("最佳員工：張小明");
  });

  it("揭曉時顯示 emoji", () => {
    const startedAt = Date.now() - 5000;
    const state: CountdownRevealState = { startedAt, startedBy: "u1" };
    render(<CountdownReveal config={defaultConfig} state={state} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByTestId("reveal-emoji")).toHaveTextContent("🏆");
  });

  it("揭曉時不顯示倒數數字", () => {
    const startedAt = Date.now() - 5000;
    const state: CountdownRevealState = { startedAt, startedBy: "u1" };
    render(<CountdownReveal config={defaultConfig} state={state} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.queryByTestId("countdown-number")).not.toBeInTheDocument();
  });

  it("未開始時不顯示倒數區塊", () => {
    render(<CountdownReveal config={defaultConfig} state={idleState} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.queryByTestId("countdown-active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("countdown-revealed")).not.toBeInTheDocument();
  });

  it("預設懸念訊息在無 suspenseMessage 時顯示", () => {
    const cfg: CountdownRevealConfig = { revealText: "揭曉！", durationSeconds: 3 };
    render(<CountdownReveal config={cfg} state={idleState} myUserId="u1" onStart={mockOnStart} />);
    expect(screen.getByText("準備好了嗎？倒數即將開始…")).toBeInTheDocument();
  });
});
