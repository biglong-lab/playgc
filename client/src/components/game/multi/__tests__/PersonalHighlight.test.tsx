import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonalHighlight } from "../PersonalHighlight";

let mockState: Record<string, unknown> = {};
const mockUpdateState = vi.fn((s: unknown) => { mockState = s as Record<string, unknown>; });
let mockIsLoaded = true;

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  config: { title: "個人亮點", prompt: "分享你的成就！" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("PersonalHighlight", () => {
  it("顯示標題和提示", () => {
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-title")).toHaveTextContent("個人亮點");
    expect(screen.getByTestId("ph-prompt")).toHaveTextContent("分享你的成就！");
  });

  it("顯示已分享人數（初始為 0）", () => {
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-count")).toHaveTextContent("0");
  });

  it("未提交前顯示輸入欄", () => {
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("ph-detail-input")).toBeInTheDocument();
    expect(screen.getByTestId("ph-submit-btn")).toBeInTheDocument();
  });

  it("標題為空時提交按鈕 disabled", () => {
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-submit-btn")).toBeDisabled();
  });

  it("填入標題後按鈕 enabled", () => {
    render(<PersonalHighlight {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ph-title-input"), { target: { value: "達成季度目標" } });
    expect(screen.getByTestId("ph-submit-btn")).not.toBeDisabled();
  });

  it("提交呼叫 updateState 帶入正確 title", () => {
    render(<PersonalHighlight {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ph-title-input"), { target: { value: "成功簡報" } });
    fireEvent.change(screen.getByTestId("ph-detail-input"), { target: { value: "說服了所有人" } });
    fireEvent.click(screen.getByTestId("ph-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { title: string; detail: string }[] };
    expect(called.entries[0].title).toBe("成功簡報");
    expect(called.entries[0].detail).toBe("說服了所有人");
  });

  it("已提交後顯示 my-entry badge", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", title: "季度最佳", detail: "出色的表現" }],
      revealed: false,
    };
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("ph-my-entry")).toHaveTextContent("季度最佳");
  });

  it("已提交後不再顯示輸入欄", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", title: "季度最佳", detail: "" }],
      revealed: false,
    };
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.queryByTestId("ph-title-input")).not.toBeInTheDocument();
  });

  it("isTeamLead 顯示展示所有亮點按鈕", () => {
    render(<PersonalHighlight {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ph-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示展示按鈕", () => {
    render(<PersonalHighlight {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ph-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊展示呼叫 updateState revealed=true", () => {
    render(<PersonalHighlight {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ph-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示 ph-result 及每筆 entry", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", title: "A成就", detail: "" },
        { entryId: "e2", userId: "u2", userName: "Bob", title: "B成就", detail: "細節" },
      ],
      revealed: true,
    };
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-result")).toBeInTheDocument();
    expect(screen.getByTestId("ph-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("ph-entry-e2")).toBeInTheDocument();
  });

  it("revealed + 無分享顯示 empty 提示", () => {
    mockState = { entries: [], revealed: true };
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-empty")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<PersonalHighlight {...defaultProps} />);
    expect(screen.getByTestId("ph-loading")).toBeInTheDocument();
  });
});
