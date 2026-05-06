import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BoardGame } from "../BoardGame";

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

describe("BoardGame", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-title")).toHaveTextContent("我是哪種桌遊");
  });

  it("顯示自訂標題", () => {
    render(<BoardGame {...defaultProps} config={{ title: "桌遊個性測驗" }} />);
    expect(screen.getByTestId("bg-title")).toHaveTextContent("桌遊個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<BoardGame {...defaultProps} config={{ prompt: "你是什麼桌遊？" }} />);
    expect(screen.getByTestId("bg-prompt")).toHaveTextContent("你是什麼桌遊？");
  });

  it("顯示已選人數", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-form")).toBeInTheDocument();
  });

  it("顯示所有桌遊選項", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-game-chess")).toBeInTheDocument();
    expect(screen.getByTestId("bg-game-poker")).toBeInTheDocument();
    expect(screen.getByTestId("bg-game-mahjong")).toBeInTheDocument();
    expect(screen.getByTestId("bg-game-party")).toBeInTheDocument();
  });

  it("未選桌遊時提交按鈕 disabled", () => {
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-submit-btn")).toBeDisabled();
  });

  it("選桌遊但理由不足 5 字時提交按鈕 disabled", () => {
    render(<BoardGame {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bg-game-chess"));
    fireEvent.change(screen.getByTestId("bg-reason-input"), { target: { value: "謀" } });
    expect(screen.getByTestId("bg-submit-btn")).toBeDisabled();
  });

  it("選桌遊且理由足夠時可提交", () => {
    render(<BoardGame {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bg-game-trivia"));
    fireEvent.change(screen.getByTestId("bg-reason-input"), { target: { value: "博學多聞知識淵博" } });
    expect(screen.getByTestId("bg-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<BoardGame {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bg-game-roleplaying"));
    fireEvent.change(screen.getByTestId("bg-reason-input"), { target: { value: "創意豐富善於表達" } });
    fireEvent.click(screen.getByTestId("bg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].game).toBe("roleplaying");
    expect(call.entries[0].reason).toBe("創意豐富善於表達");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", game: "strategy", reason: "全局思考系統規劃" }],
      revealed: false,
    };
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("bg-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<BoardGame {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("bg-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<BoardGame {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("bg-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", game: "uno", reason: "充滿驚喜喜歡翻盤" }],
      revealed: true,
    };
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-result")).toBeInTheDocument();
    expect(screen.getByTestId("bg-game-summary")).toBeInTheDocument();
    expect(screen.getByTestId("bg-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示桌遊徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", game: "monopoly", reason: "積極進取掌握資源" }],
      revealed: true,
    };
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-badge-monopoly")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-stu", userId: "u1", userName: "Tester", game: "party", reason: "活潑開朗帶動氣氛" }],
      revealed: true,
    };
    render(<BoardGame {...defaultProps} />);
    expect(screen.getByTestId("bg-card-u1-stu")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<BoardGame {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("bg-reveal-btn")).not.toBeInTheDocument();
  });
});
