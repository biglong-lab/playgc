import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventTimeline } from "../EventTimeline";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { events: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

const baseProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  isTeamLead: true,
};

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { events: [], revealed: false };
});

describe("EventTimeline", () => {
  it("顯示標題", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-title")).toBeInTheDocument();
  });

  it("顯示提示文字", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-prompt")).toBeInTheDocument();
  });

  it("顯示事件數量", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-count")).toHaveTextContent("0");
  });

  it("顯示時間和事件輸入框", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-time-input")).toBeInTheDocument();
    expect(screen.getByTestId("etl-text-input")).toBeInTheDocument();
  });

  it("空白時 submit 按鈕 disabled", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-submit-btn")).toBeDisabled();
  });

  it("只填時間時仍 disabled", () => {
    render(<EventTimeline {...baseProps} />);
    fireEvent.change(screen.getByTestId("etl-time-input"), { target: { value: "2024年" } });
    expect(screen.getByTestId("etl-submit-btn")).toBeDisabled();
  });

  it("填寫時間和事件後可提交", () => {
    render(<EventTimeline {...baseProps} />);
    fireEvent.change(screen.getByTestId("etl-time-input"), { target: { value: "2024年3月" } });
    fireEvent.change(screen.getByTestId("etl-text-input"), { target: { value: "公司成立" } });
    expect(screen.getByTestId("etl-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("etl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.events).toHaveLength(1);
    expect(call.events[0].time).toBe("2024年3月");
    expect(call.events[0].text).toBe("公司成立");
  });

  it("提交後顯示 my-events", () => {
    mockState = {
      events: [{ eventId: "u1-1", userId: "u1", userName: "測試員", time: "2024年", text: "里程碑" }],
      revealed: false,
    };
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-my-events")).toBeInTheDocument();
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示時間軸結果", () => {
    mockState = {
      events: [{ eventId: "u2-1", userId: "u2", userName: "玩家2", time: "2025年", text: "啟動計畫" }],
      revealed: true,
    };
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-result")).toBeInTheDocument();
    expect(screen.getByTestId("etl-event-u2-1")).toBeInTheDocument();
  });

  it("揭曉後無事件顯示 empty", () => {
    mockState = { events: [], revealed: true };
    render(<EventTimeline {...baseProps} />);
    expect(screen.getByTestId("etl-empty")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<EventTimeline {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("etl-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後輸入框不顯示", () => {
    mockState = { events: [], revealed: true };
    render(<EventTimeline {...baseProps} />);
    expect(screen.queryByTestId("etl-submit-btn")).not.toBeInTheDocument();
  });
});
