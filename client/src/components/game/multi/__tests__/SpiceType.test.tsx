import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpiceType } from "../SpiceType";

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

describe("SpiceType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-title")).toHaveTextContent("我是哪種香料");
  });

  it("顯示自訂標題", () => {
    render(<SpiceType {...defaultProps} config={{ title: "香料個性測驗" }} />);
    expect(screen.getByTestId("spc-title")).toHaveTextContent("香料個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<SpiceType {...defaultProps} config={{ prompt: "你是什麼香料？" }} />);
    expect(screen.getByTestId("spc-prompt")).toHaveTextContent("你是什麼香料？");
  });

  it("顯示已選人數", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-form")).toBeInTheDocument();
  });

  it("顯示所有香料選項", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-spice-chili")).toBeInTheDocument();
    expect(screen.getByTestId("spc-spice-ginger")).toBeInTheDocument();
    expect(screen.getByTestId("spc-spice-vanilla")).toBeInTheDocument();
    expect(screen.getByTestId("spc-spice-basil")).toBeInTheDocument();
  });

  it("未選香料時提交按鈕 disabled", () => {
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-submit-btn")).toBeDisabled();
  });

  it("選香料但理由不足 5 字時提交按鈕 disabled", () => {
    render(<SpiceType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spc-spice-chili"));
    fireEvent.change(screen.getByTestId("spc-reason-input"), { target: { value: "辣" } });
    expect(screen.getByTestId("spc-submit-btn")).toBeDisabled();
  });

  it("選香料且理由足夠時可提交", () => {
    render(<SpiceType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spc-spice-cinnamon"));
    fireEvent.change(screen.getByTestId("spc-reason-input"), { target: { value: "溫暖甜蜜充滿魅力" } });
    expect(screen.getByTestId("spc-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<SpiceType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spc-spice-vanilla"));
    fireEvent.change(screen.getByTestId("spc-reason-input"), { target: { value: "溫和細膩百搭包容" } });
    fireEvent.click(screen.getByTestId("spc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].spice).toBe("vanilla");
    expect(call.entries[0].reason).toBe("溫和細膩百搭包容");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", spice: "garlic", reason: "個性鮮明存在感強" }],
      revealed: false,
    };
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("spc-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<SpiceType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("spc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SpiceType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("spc-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", spice: "pepper", reason: "低調深邃回味悠長" }],
      revealed: true,
    };
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-result")).toBeInTheDocument();
    expect(screen.getByTestId("spc-spice-summary")).toBeInTheDocument();
    expect(screen.getByTestId("spc-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示香料徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", spice: "cardamom", reason: "神秘複雜層次豐富" }],
      revealed: true,
    };
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-badge-cardamom")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-pqr", userId: "u1", userName: "Tester", spice: "turmeric", reason: "健康自然獨樹一幟" }],
      revealed: true,
    };
    render(<SpiceType {...defaultProps} />);
    expect(screen.getByTestId("spc-card-u1-pqr")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<SpiceType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("spc-reveal-btn")).not.toBeInTheDocument();
  });
});
