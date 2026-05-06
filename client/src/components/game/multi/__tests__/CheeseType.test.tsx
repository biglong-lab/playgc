import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CheeseType } from "../CheeseType";

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

describe("CheeseType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-title")).toHaveTextContent("我是哪種起司");
  });

  it("顯示自訂標題", () => {
    render(<CheeseType {...defaultProps} config={{ title: "起司個性測驗" }} />);
    expect(screen.getByTestId("che-title")).toHaveTextContent("起司個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<CheeseType {...defaultProps} config={{ prompt: "你是什麼起司？" }} />);
    expect(screen.getByTestId("che-prompt")).toHaveTextContent("你是什麼起司？");
  });

  it("顯示已選人數", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-form")).toBeInTheDocument();
  });

  it("顯示所有起司選項", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-cheese-cheddar")).toBeInTheDocument();
    expect(screen.getByTestId("che-cheese-brie")).toBeInTheDocument();
    expect(screen.getByTestId("che-cheese-gouda")).toBeInTheDocument();
    expect(screen.getByTestId("che-cheese-parmesan")).toBeInTheDocument();
  });

  it("未選起司時提交按鈕 disabled", () => {
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-submit-btn")).toBeDisabled();
  });

  it("選起司但理由不足 5 字時提交按鈕 disabled", () => {
    render(<CheeseType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("che-cheese-brie"));
    fireEvent.change(screen.getByTestId("che-reason-input"), { target: { value: "柔軟" } });
    expect(screen.getByTestId("che-submit-btn")).toBeDisabled();
  });

  it("選起司且理由足夠時可提交", () => {
    render(<CheeseType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("che-cheese-parmesan"));
    fireEvent.change(screen.getByTestId("che-reason-input"), { target: { value: "越陳越香深厚底蘊" } });
    expect(screen.getByTestId("che-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<CheeseType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("che-cheese-mozzarella"));
    fireEvent.change(screen.getByTestId("che-reason-input"), { target: { value: "清新純淨彈性十足" } });
    fireEvent.click(screen.getByTestId("che-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].cheese).toBe("mozzarella");
    expect(call.entries[0].reason).toBe("清新純淨彈性十足");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", cheese: "feta", reason: "清爽直率鮮明個性" }],
      revealed: false,
    };
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("che-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<CheeseType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("che-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<CheeseType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("che-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", cheese: "camembert", reason: "外表平靜內心豐富" }],
      revealed: true,
    };
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-result")).toBeInTheDocument();
    expect(screen.getByTestId("che-cheese-summary")).toBeInTheDocument();
    expect(screen.getByTestId("che-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示起司徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", cheese: "ricotta", reason: "輕盈溫柔包容萬物" }],
      revealed: true,
    };
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-badge-ricotta")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-mno", userId: "u1", userName: "Tester", cheese: "swiss", reason: "孔洞獨特別具風味" }],
      revealed: true,
    };
    render(<CheeseType {...defaultProps} />);
    expect(screen.getByTestId("che-card-u1-mno")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<CheeseType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("che-reveal-btn")).not.toBeInTheDocument();
  });
});
