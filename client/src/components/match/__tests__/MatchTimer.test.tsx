import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import MatchTimer from "../MatchTimer";

describe("MatchTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // --- countdown 模式 ---
  it("countdown 模式渲染初始秒數", () => {
    render(<MatchTimer mode="countdown" seconds={30} />);
    expect(screen.getByText("00:30")).toBeInTheDocument();
  });

  it("countdown 模式每秒遞減", () => {
    render(<MatchTimer mode="countdown" seconds={5} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("00:03")).toBeInTheDocument();
  });

  it("countdown 到 0 呼叫 onCountdownEnd", () => {
    const onEnd = vi.fn();
    render(<MatchTimer mode="countdown" seconds={2} onCountdownEnd={onEnd} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("countdown ≤10 秒顯示 destructive 樣式", () => {
    render(<MatchTimer mode="countdown" seconds={8} />);
    const container = screen.getByText("00:08").closest("div");
    expect(container?.className).toContain("destructive");
    expect(container?.className).toContain("animate-pulse");
  });

  it("countdown >10 秒不顯示 destructive 樣式", () => {
    render(<MatchTimer mode="countdown" seconds={30} />);
    const container = screen.getByText("00:30").closest("div");
    expect(container?.className).toContain("bg-muted");
    expect(container?.className).not.toContain("destructive");
  });

  it("countdown 模式顯示 Timer icon", () => {
    const { container } = render(<MatchTimer mode="countdown" seconds={60} />);
    // lucide Timer 含有 svg
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  // --- elapsed 模式 ---
  it("elapsed 模式初始為 00:00", () => {
    render(<MatchTimer mode="elapsed" seconds={0} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("elapsed 模式每秒遞增", () => {
    render(<MatchTimer mode="elapsed" seconds={0} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("00:03")).toBeInTheDocument();
  });

  it("elapsed 模式不顯示 destructive 樣式", () => {
    render(<MatchTimer mode="elapsed" seconds={0} />);
    act(() => { vi.advanceTimersByTime(5000); });
    const container = screen.getByText("00:05").closest("div");
    expect(container?.className).toContain("bg-muted");
  });

  // --- 格式化 ---
  it("格式化分鐘：90 秒顯示 01:30", () => {
    render(<MatchTimer mode="countdown" seconds={90} />);
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });

  it("秒數變更後重置計時", () => {
    const { rerender } = render(<MatchTimer mode="countdown" seconds={30} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText("00:25")).toBeInTheDocument();
    // 秒數變更
    rerender(<MatchTimer mode="countdown" seconds={60} />);
    expect(screen.getByText("01:00")).toBeInTheDocument();
  });
});
