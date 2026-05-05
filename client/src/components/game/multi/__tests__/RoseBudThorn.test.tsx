import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoseBudThorn } from "../RoseBudThorn";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

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
  mockState = { entries: [], revealed: false };
});

describe("RoseBudThorn", () => {
  it("顯示標題", () => {
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-title")).toBeInTheDocument();
  });

  it("顯示提交人數", () => {
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-count")).toHaveTextContent("0");
  });

  it("顯示三個輸入框", () => {
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-rose-input")).toBeInTheDocument();
    expect(screen.getByTestId("rbt-bud-input")).toBeInTheDocument();
    expect(screen.getByTestId("rbt-thorn-input")).toBeInTheDocument();
  });

  it("三個都空白時 submit 按鈕 disabled", () => {
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-submit-btn")).toBeDisabled();
  });

  it("部分填寫時 submit 按鈕仍 disabled", () => {
    render(<RoseBudThorn {...baseProps} />);
    fireEvent.change(screen.getByTestId("rbt-rose-input"), { target: { value: "很棒的協作" } });
    expect(screen.getByTestId("rbt-submit-btn")).toBeDisabled();
  });

  it("三欄都填寫後可提交", () => {
    render(<RoseBudThorn {...baseProps} />);
    fireEvent.change(screen.getByTestId("rbt-rose-input"), { target: { value: "很棒的協作" } });
    fireEvent.change(screen.getByTestId("rbt-bud-input"), { target: { value: "可以更快" } });
    fireEvent.change(screen.getByTestId("rbt-thorn-input"), { target: { value: "溝通不順" } });
    expect(screen.getByTestId("rbt-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("rbt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries).toHaveLength(1);
    expect(call.entries[0].rose).toBe("很棒的協作");
    expect(call.entries[0].bud).toBe("可以更快");
    expect(call.entries[0].thorn).toBe("溝通不順");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "測試員", rose: "棒", bud: "潛力", thorn: "問題" }],
      revealed: false,
    };
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("rbt-my-entry")).toHaveTextContent("棒");
    expect(screen.getByTestId("rbt-my-entry")).toHaveTextContent("潛力");
    expect(screen.getByTestId("rbt-my-entry")).toHaveTextContent("問題");
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u2-1", userId: "u2", userName: "玩家2", rose: "好", bud: "期待", thorn: "障礙" }],
      revealed: true,
    };
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-result")).toBeInTheDocument();
    expect(screen.getByTestId("rbt-entry-u2-1")).toBeInTheDocument();
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<RoseBudThorn {...baseProps} />);
    expect(screen.getByTestId("rbt-empty")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<RoseBudThorn {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("rbt-reveal-btn")).not.toBeInTheDocument();
  });
});
