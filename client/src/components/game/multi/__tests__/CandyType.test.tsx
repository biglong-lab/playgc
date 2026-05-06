import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CandyType } from "../CandyType";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Tester", email: "t@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("CandyType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-title")).toHaveTextContent("我是哪種糖果");
  });

  it("顯示自訂標題", () => {
    render(<CandyType {...defaultProps} config={{ title: "糖果個性測驗" }} />);
    expect(screen.getByTestId("cdy-title")).toHaveTextContent("糖果個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<CandyType {...defaultProps} config={{ prompt: "你是什麼糖果？" }} />);
    expect(screen.getByTestId("cdy-prompt")).toHaveTextContent("你是什麼糖果？");
  });

  it("顯示已選人數", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-form")).toBeInTheDocument();
  });

  it("顯示所有糖果選項", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-candy-chocolate")).toBeInTheDocument();
    expect(screen.getByTestId("cdy-candy-gummy")).toBeInTheDocument();
    expect(screen.getByTestId("cdy-candy-lollipop")).toBeInTheDocument();
    expect(screen.getByTestId("cdy-candy-mint")).toBeInTheDocument();
  });

  it("未選糖果時提交按鈕 disabled", () => {
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-submit-btn")).toBeDisabled();
  });

  it("選糖果但理由不足 5 字時提交按鈕 disabled", () => {
    render(<CandyType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cdy-candy-chocolate"));
    fireEvent.change(screen.getByTestId("cdy-reason-input"), { target: { value: "甜" } });
    expect(screen.getByTestId("cdy-submit-btn")).toBeDisabled();
  });

  it("選糖果且理由足夠時可提交", () => {
    render(<CandyType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cdy-candy-caramel"));
    fireEvent.change(screen.getByTestId("cdy-reason-input"), { target: { value: "甜中帶苦層次豐富" } });
    expect(screen.getByTestId("cdy-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<CandyType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cdy-candy-marshmallow"));
    fireEvent.change(screen.getByTestId("cdy-reason-input"), { target: { value: "柔軟療癒讓人放鬆" } });
    fireEvent.click(screen.getByTestId("cdy-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].candy).toBe("marshmallow");
    expect(call.entries[0].reason).toBe("柔軟療癒讓人放鬆");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", candy: "sour", reason: "刺激獨特讓人難忘" }],
      revealed: false,
    };
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("cdy-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<CandyType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cdy-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<CandyType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cdy-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", candy: "lollipop", reason: "活潑多彩帶來歡樂" }],
      revealed: true,
    };
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-result")).toBeInTheDocument();
    expect(screen.getByTestId("cdy-candy-summary")).toBeInTheDocument();
    expect(screen.getByTestId("cdy-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示糖果徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", candy: "hard_candy", reason: "持久耐得住慢慢品味" }],
      revealed: true,
    };
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-badge-hard_candy")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-mno", userId: "u1", userName: "Tester", candy: "cotton_candy", reason: "夢幻輕盈充滿想像" }],
      revealed: true,
    };
    render(<CandyType {...defaultProps} />);
    expect(screen.getByTestId("cdy-card-u1-mno")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<CandyType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cdy-reveal-btn")).not.toBeInTheDocument();
  });
});
