import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TreeType } from "../TreeType";

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

describe("TreeType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-title")).toHaveTextContent("我是哪種樹");
  });

  it("顯示自訂標題", () => {
    render(<TreeType {...defaultProps} config={{ title: "樹木個性測驗" }} />);
    expect(screen.getByTestId("tre-title")).toHaveTextContent("樹木個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<TreeType {...defaultProps} config={{ prompt: "你是什麼樹？" }} />);
    expect(screen.getByTestId("tre-prompt")).toHaveTextContent("你是什麼樹？");
  });

  it("顯示已選人數", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-form")).toBeInTheDocument();
  });

  it("顯示所有樹木選項", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-tree-oak")).toBeInTheDocument();
    expect(screen.getByTestId("tre-tree-bamboo")).toBeInTheDocument();
    expect(screen.getByTestId("tre-tree-cherry")).toBeInTheDocument();
    expect(screen.getByTestId("tre-tree-cactus")).toBeInTheDocument();
  });

  it("未選樹木時提交按鈕 disabled", () => {
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-submit-btn")).toBeDisabled();
  });

  it("選樹木但理由不足 5 字時提交按鈕 disabled", () => {
    render(<TreeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tre-tree-bamboo"));
    fireEvent.change(screen.getByTestId("tre-reason-input"), { target: { value: "韌" } });
    expect(screen.getByTestId("tre-submit-btn")).toBeDisabled();
  });

  it("選樹木且理由足夠時可提交", () => {
    render(<TreeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tre-tree-pine"));
    fireEvent.change(screen.getByTestId("tre-reason-input"), { target: { value: "四季常青意志堅定" } });
    expect(screen.getByTestId("tre-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<TreeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tre-tree-oak"));
    fireEvent.change(screen.getByTestId("tre-reason-input"), { target: { value: "穩固強韌長久可靠" } });
    fireEvent.click(screen.getByTestId("tre-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].tree).toBe("oak");
    expect(call.entries[0].reason).toBe("穩固強韌長久可靠");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", tree: "willow", reason: "柔軟靈活隨遇而安" }],
      revealed: false,
    };
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("tre-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<TreeType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("tre-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<TreeType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tre-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", tree: "banyan", reason: "包容廣納庇護眾人" }],
      revealed: true,
    };
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-result")).toBeInTheDocument();
    expect(screen.getByTestId("tre-tree-summary")).toBeInTheDocument();
    expect(screen.getByTestId("tre-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示樹木徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", tree: "maple", reason: "優雅轉變情感豐富" }],
      revealed: true,
    };
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-badge-maple")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-ghi", userId: "u1", userName: "Tester", tree: "birch", reason: "清新純淨簡約之美" }],
      revealed: true,
    };
    render(<TreeType {...defaultProps} />);
    expect(screen.getByTestId("tre-card-u1-ghi")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<TreeType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("tre-reveal-btn")).not.toBeInTheDocument();
  });
});
