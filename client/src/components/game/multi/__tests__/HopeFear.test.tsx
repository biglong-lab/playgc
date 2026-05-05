import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HopeFear } from "../HopeFear";

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

describe("HopeFear", () => {
  it("顯示標題", () => {
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-title")).toBeInTheDocument();
  });

  it("顯示提交人數", () => {
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-count")).toHaveTextContent("0");
  });

  it("顯示希望和恐懼輸入框", () => {
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-hope-input")).toBeInTheDocument();
    expect(screen.getByTestId("hf-fear-input")).toBeInTheDocument();
  });

  it("兩欄都空白時 submit 按鈕 disabled", () => {
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-submit-btn")).toBeDisabled();
  });

  it("只填希望時仍 disabled", () => {
    render(<HopeFear {...baseProps} />);
    fireEvent.change(screen.getByTestId("hf-hope-input"), { target: { value: "希望成功" } });
    expect(screen.getByTestId("hf-submit-btn")).toBeDisabled();
  });

  it("兩欄都填後可提交", () => {
    render(<HopeFear {...baseProps} />);
    fireEvent.change(screen.getByTestId("hf-hope-input"), { target: { value: "希望成功" } });
    fireEvent.change(screen.getByTestId("hf-fear-input"), { target: { value: "擔心失敗" } });
    expect(screen.getByTestId("hf-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("hf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries).toHaveLength(1);
    expect(call.entries[0].hope).toBe("希望成功");
    expect(call.entries[0].fear).toBe("擔心失敗");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "測試員", hope: "希望成功", fear: "擔心失敗" }],
      revealed: false,
    };
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("hf-my-entry")).toHaveTextContent("希望成功");
    expect(screen.getByTestId("hf-my-entry")).toHaveTextContent("擔心失敗");
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示所有 entries", () => {
    mockState = {
      entries: [{ entryId: "u2-1", userId: "u2", userName: "玩家2", hope: "好", fear: "壞" }],
      revealed: true,
    };
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-result")).toBeInTheDocument();
    expect(screen.getByTestId("hf-entry-u2-1")).toBeInTheDocument();
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<HopeFear {...baseProps} />);
    expect(screen.getByTestId("hf-empty")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<HopeFear {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("hf-reveal-btn")).not.toBeInTheDocument();
  });
});
