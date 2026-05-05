import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckIn from "../CheckIn";
import type { CheckInConfig, CheckInState, ArrivalEntry } from "../CheckIn";

const config: CheckInConfig = {
  title: "活動簽到",
  message: "點擊簽到！",
  targetCount: 10,
  showNames: true,
};

const emptyState: CheckInState = { arrivals: [] };

const makeArrival = (userId: string, userName: string, delta = 0): ArrivalEntry => ({
  userId, userName, arrivedAt: 1700000000000 + delta,
});

describe("CheckIn", () => {
  it("顯示標題", () => {
    render(<CheckIn config={config} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-title")).toHaveTextContent("活動簽到");
  });

  it("顯示到場人數 badge", () => {
    const state: CheckInState = { arrivals: [makeArrival("u2", "Bob")] };
    render(<CheckIn config={config} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-count")).toHaveTextContent("1");
    expect(screen.getByTestId("check-in-count")).toHaveTextContent("10");
  });

  it("顯示進度條（有 targetCount）", () => {
    render(<CheckIn config={config} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("check-in-bar")).toBeInTheDocument();
  });

  it("未簽到時顯示簽到按鈕", () => {
    render(<CheckIn config={config} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-btn")).toBeInTheDocument();
  });

  it("點擊簽到呼叫 onCheckIn", async () => {
    const onCheckIn = vi.fn().mockResolvedValue(undefined);
    render(<CheckIn config={config} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={onCheckIn} />);
    fireEvent.click(screen.getByTestId("check-in-btn"));
    await waitFor(() => expect(onCheckIn).toHaveBeenCalled());
  });

  it("已簽到顯示完成畫面", () => {
    const state: CheckInState = { arrivals: [makeArrival("u1", "Alice")] };
    render(<CheckIn config={config} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-done")).toBeInTheDocument();
    expect(screen.getByText("已簽到！")).toBeInTheDocument();
  });

  it("已簽到後不顯示簽到按鈕", () => {
    const state: CheckInState = { arrivals: [makeArrival("u1", "Alice")] };
    render(<CheckIn config={config} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.queryByTestId("check-in-btn")).not.toBeInTheDocument();
  });

  it("有到場者顯示名單", () => {
    const state: CheckInState = { arrivals: [makeArrival("u2", "Bob")] };
    render(<CheckIn config={config} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-list")).toBeInTheDocument();
    expect(screen.getByTestId("arrival-row-u2")).toBeInTheDocument();
  });

  it("顯示自己的名字標記（你）", () => {
    const state: CheckInState = { arrivals: [makeArrival("u1", "Alice")] };
    render(<CheckIn config={config} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByText("（你）")).toBeInTheDocument();
  });

  it("showNames=false 隱藏名單", () => {
    const cfg = { ...config, showNames: false };
    const state: CheckInState = { arrivals: [makeArrival("u2", "Bob")] };
    render(<CheckIn config={cfg} state={state} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.queryByTestId("check-in-list")).not.toBeInTheDocument();
  });

  it("使用預設標題（無 title）", () => {
    render(<CheckIn config={{}} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.getByTestId("check-in-title")).toHaveTextContent("✅ 活動簽到");
  });

  it("無 targetCount 不顯示進度條", () => {
    const cfg = { ...config, targetCount: undefined };
    render(<CheckIn config={cfg} state={emptyState} myUserId="u1" myUserName="Alice" onCheckIn={vi.fn()} />);
    expect(screen.queryByTestId("check-in-progress")).not.toBeInTheDocument();
  });
});
