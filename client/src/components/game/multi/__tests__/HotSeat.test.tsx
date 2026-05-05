import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HotSeat from "../HotSeat";
import type { HotSeatConfig, HotSeatState } from "../HotSeat";

const defaultConfig: HotSeatConfig = {
  title: "🔥 熱烤椅",
  instructions: "一人上場，全場提問！",
  durationSeconds: 180,
  maxQuestionsPerRound: 5,
};

const emptyState: HotSeatState = { current: null, history: [], volunteers: [] };

const mockSession = {
  userId: "u2",
  userName: "Bob",
  startedAt: 1000,
  questions: [],
};

const mockQuestion = {
  id: "q1",
  askerId: "u1",
  askerName: "Alice",
  text: "你最喜歡的食物是什麼？",
  askedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  myUserName: "Alice",
  draftQuestion: "",
  onDraftChange: vi.fn(),
  onVolunteer: vi.fn(),
  onAskQuestion: vi.fn(),
  onEndRound: vi.fn(),
};

describe("HotSeat", () => {
  it("顯示標題", () => {
    render(<HotSeat {...mockProps} />);
    expect(screen.getByTestId("hs-title")).toHaveTextContent("熱烤椅");
  });

  it("顯示說明", () => {
    render(<HotSeat {...mockProps} />);
    expect(screen.getByTestId("hs-instructions")).toHaveTextContent("一人上場，全場提問！");
  });

  it("無人上場時顯示等待狀態", () => {
    render(<HotSeat {...mockProps} />);
    expect(screen.getByTestId("hs-waiting")).toBeInTheDocument();
  });

  it("顯示舉手按鈕", () => {
    render(<HotSeat {...mockProps} />);
    expect(screen.getByTestId("hs-volunteer-btn")).toBeInTheDocument();
  });

  it("點擊舉手呼叫 onVolunteer", () => {
    const onVolunteer = vi.fn();
    render(<HotSeat {...mockProps} onVolunteer={onVolunteer} />);
    fireEvent.click(screen.getByTestId("hs-volunteer-btn"));
    expect(onVolunteer).toHaveBeenCalled();
  });

  it("已舉手時顯示等待訊息", () => {
    const state: HotSeatState = {
      current: null,
      history: [],
      volunteers: [{ userId: "u1", userName: "Alice" }],
    };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-volunteered-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("hs-volunteer-btn")).not.toBeInTheDocument();
  });

  it("有人上場時顯示目前上場者", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-current-seat")).toBeInTheDocument();
    expect(screen.getByTestId("hs-current-name")).toHaveTextContent("Bob");
  });

  it("非上場者可以提問", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("hs-ask-form")).toBeInTheDocument();
  });

  it("提問按鈕空白時 disabled", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} draftQuestion="" />);
    expect(screen.getByTestId("hs-ask-btn")).toBeDisabled();
  });

  it("提問按鈕有文字時啟用", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} draftQuestion="這是問題" />);
    expect(screen.getByTestId("hs-ask-btn")).not.toBeDisabled();
  });

  it("點擊提問呼叫 onAskQuestion", () => {
    const onAskQuestion = vi.fn();
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} draftQuestion="這是問題" onAskQuestion={onAskQuestion} />);
    fireEvent.click(screen.getByTestId("hs-ask-btn"));
    expect(onAskQuestion).toHaveBeenCalled();
  });

  it("上場者不看到提問表單", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} myUserId="u2" />);
    expect(screen.queryByTestId("hs-ask-form")).not.toBeInTheDocument();
  });

  it("上場者看到結束按鈕", () => {
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} myUserId="u2" />);
    expect(screen.getByTestId("hs-end-btn")).toBeInTheDocument();
  });

  it("點擊結束呼叫 onEndRound", () => {
    const onEndRound = vi.fn();
    const state: HotSeatState = { current: mockSession, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} myUserId="u2" onEndRound={onEndRound} />);
    fireEvent.click(screen.getByTestId("hs-end-btn"));
    expect(onEndRound).toHaveBeenCalled();
  });

  it("顯示問題列表", () => {
    const session = { ...mockSession, questions: [mockQuestion] };
    const state: HotSeatState = { current: session, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-question-list")).toBeInTheDocument();
    expect(screen.getByTestId("hs-q-q1")).toHaveTextContent("你最喜歡的食物");
  });

  it("達到問題上限顯示提示", () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({ ...mockQuestion, id: `q${i}` }));
    const session = { ...mockSession, questions };
    const state: HotSeatState = { current: session, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-max-questions")).toBeInTheDocument();
  });

  it("顯示問題計數", () => {
    const session = { ...mockSession, questions: [mockQuestion] };
    const state: HotSeatState = { current: session, history: [], volunteers: [] };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-question-count")).toHaveTextContent("1");
  });

  it("顯示歷史記錄", () => {
    const state: HotSeatState = {
      current: null,
      history: [mockSession],
      volunteers: [],
    };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-history")).toBeInTheDocument();
    expect(screen.getByTestId("hs-history-0")).toHaveTextContent("Bob");
  });

  it("顯示排隊志願者", () => {
    const state: HotSeatState = {
      current: null,
      history: [],
      volunteers: [{ userId: "u3", userName: "Carol" }],
    };
    render(<HotSeat {...mockProps} state={state} />);
    expect(screen.getByTestId("hs-volunteer-list")).toBeInTheDocument();
    expect(screen.getByTestId("hs-vol-u3")).toHaveTextContent("Carol");
  });
});
