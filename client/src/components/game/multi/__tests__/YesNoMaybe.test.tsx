import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YesNoMaybe } from "../YesNoMaybe";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { votes: [], revealed: false };

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
  mockState = { votes: [], revealed: false };
});

describe("YesNoMaybe", () => {
  it("顯示標題", () => {
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-title")).toBeInTheDocument();
  });

  it("顯示問題", () => {
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-question")).toBeInTheDocument();
  });

  it("顯示投票人數", () => {
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-count")).toHaveTextContent("0");
  });

  it("顯示三個投票按鈕", () => {
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-yes-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ynm-no-btn")).toBeInTheDocument();
    expect(screen.getByTestId("ynm-maybe-btn")).toBeInTheDocument();
  });

  it("點 yes 更新狀態", () => {
    render(<YesNoMaybe {...baseProps} />);
    fireEvent.click(screen.getByTestId("ynm-yes-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes).toHaveLength(1);
    expect(call.votes[0].choice).toBe("yes");
  });

  it("點 no 更新狀態", () => {
    render(<YesNoMaybe {...baseProps} />);
    fireEvent.click(screen.getByTestId("ynm-no-btn"));
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes[0].choice).toBe("no");
  });

  it("點 maybe 更新狀態", () => {
    render(<YesNoMaybe {...baseProps} />);
    fireEvent.click(screen.getByTestId("ynm-maybe-btn"));
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes[0].choice).toBe("maybe");
  });

  it("已投票後顯示 my-vote", () => {
    mockState = { votes: [{ voteId: "u1-ynm", userId: "u1", userName: "測試員", choice: "yes" }], revealed: false };
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-my-vote")).toBeInTheDocument();
    expect(screen.getByTestId("ynm-my-vote")).toHaveTextContent("同意");
  });

  it("再次點相同選項取消投票", () => {
    mockState = { votes: [{ voteId: "u1-ynm", userId: "u1", userName: "測試員", choice: "yes" }], revealed: false };
    render(<YesNoMaybe {...baseProps} />);
    fireEvent.click(screen.getByTestId("ynm-yes-btn"));
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.votes).toHaveLength(0);
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示結果", () => {
    mockState = {
      votes: [
        { voteId: "u1-ynm", userId: "u1", userName: "A", choice: "yes" },
        { voteId: "u2-ynm", userId: "u2", userName: "B", choice: "yes" },
        { voteId: "u3-ynm", userId: "u3", userName: "C", choice: "no" },
      ],
      revealed: true,
    };
    render(<YesNoMaybe {...baseProps} />);
    expect(screen.getByTestId("ynm-result")).toBeInTheDocument();
    expect(screen.getByTestId("ynm-yes-count")).toHaveTextContent("2");
    expect(screen.getByTestId("ynm-no-count")).toHaveTextContent("1");
    expect(screen.getByTestId("ynm-maybe-count")).toHaveTextContent("0");
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<YesNoMaybe {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ynm-reveal-btn")).not.toBeInTheDocument();
  });
});
