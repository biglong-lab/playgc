import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupNorm } from "../GroupNorm";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { norms: [], votes: [], revealed: false };

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
  mockState = { norms: [], votes: [], revealed: false };
});

describe("GroupNorm", () => {
  it("顯示標題", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-title")).toBeInTheDocument();
  });

  it("顯示提示文字", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-prompt")).toBeInTheDocument();
  });

  it("顯示約定數量", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-count")).toHaveTextContent("0");
  });

  it("無約定時顯示 empty", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-empty")).toBeInTheDocument();
  });

  it("空白時 submit 按鈕 disabled", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-submit-btn")).toBeDisabled();
  });

  it("輸入後可提出約定", () => {
    render(<GroupNorm {...baseProps} />);
    fireEvent.change(screen.getByTestId("gn-input"), { target: { value: "開會前先準備議程" } });
    expect(screen.getByTestId("gn-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("gn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.norms).toHaveLength(1);
    expect(call.norms[0].text).toBe("開會前先準備議程");
  });

  it("按 Enter 也可提出", () => {
    render(<GroupNorm {...baseProps} />);
    fireEvent.change(screen.getByTestId("gn-input"), { target: { value: "尊重每個人的時間" } });
    fireEvent.keyDown(screen.getByTestId("gn-input"), { key: "Enter" });
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
  });

  it("顯示已有的約定", () => {
    mockState = {
      norms: [{ normId: "n1", userId: "u2", userName: "玩家2", text: "準時出席" }],
      votes: [],
      revealed: false,
    };
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-norm-n1")).toBeInTheDocument();
    expect(screen.getByTestId("gn-vote-count-n1")).toHaveTextContent("0");
  });

  it("對約定按讚投票", () => {
    mockState = {
      norms: [{ normId: "n1", userId: "u2", userName: "玩家2", text: "準時出席" }],
      votes: [],
      revealed: false,
    };
    render(<GroupNorm {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-vote-n1"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes).toHaveLength(1);
    expect(call.votes[0].normId).toBe("n1");
  });

  it("已投讚再點一次取消", () => {
    mockState = {
      norms: [{ normId: "n1", userId: "u2", userName: "玩家2", text: "準時出席" }],
      votes: [{ voteId: "u1-n1", userId: "u1", normId: "n1" }],
      revealed: false,
    };
    render(<GroupNorm {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-vote-n1"));
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes).toHaveLength(0);
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示結果", () => {
    mockState = {
      norms: [{ normId: "n1", userId: "u2", userName: "玩家2", text: "準時出席" }],
      votes: [{ voteId: "u1-n1", userId: "u1", normId: "n1" }],
      revealed: true,
    };
    render(<GroupNorm {...baseProps} />);
    expect(screen.getByTestId("gn-result")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<GroupNorm {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("gn-reveal-btn")).not.toBeInTheDocument();
  });
});
