import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GiveGet } from "../GiveGet";

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

describe("GiveGet", () => {
  it("顯示標題", () => {
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-title")).toBeInTheDocument();
  });

  it("顯示提交數量", () => {
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-count")).toHaveTextContent("0");
  });

  it("顯示 give/get 輸入框", () => {
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-give-input")).toBeInTheDocument();
    expect(screen.getByTestId("gvgt-get-input")).toBeInTheDocument();
  });

  it("按鈕在空白時 disabled", () => {
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-submit-btn")).toBeDisabled();
  });

  it("填寫內容後可以提交", () => {
    render(<GiveGet {...baseProps} />);
    fireEvent.change(screen.getByTestId("gvgt-give-input"), { target: { value: "我可以設計" } });
    fireEvent.change(screen.getByTestId("gvgt-get-input"), { target: { value: "需要行銷幫助" } });
    expect(screen.getByTestId("gvgt-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("gvgt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries).toHaveLength(1);
    expect(call.entries[0].give).toBe("我可以設計");
    expect(call.entries[0].get).toBe("需要行銷幫助");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "測試員", give: "設計", get: "行銷" }],
      revealed: false,
    };
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("gvgt-my-entry")).toHaveTextContent("設計");
    expect(screen.getByTestId("gvgt-my-entry")).toHaveTextContent("行銷");
  });

  it("team lead 未揭曉時顯示揭曉按鈕", () => {
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示所有 entries", () => {
    mockState = {
      entries: [{ entryId: "u2-1", userId: "u2", userName: "玩家2", give: "程式", get: "創意" }],
      revealed: true,
    };
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-result")).toBeInTheDocument();
    expect(screen.getByTestId("gvgt-entry-u2-1")).toBeInTheDocument();
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<GiveGet {...baseProps} />);
    expect(screen.getByTestId("gvgt-empty")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<GiveGet {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("gvgt-reveal-btn")).not.toBeInTheDocument();
  });
});
