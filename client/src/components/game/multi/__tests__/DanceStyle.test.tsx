import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DanceStyle } from "../DanceStyle";

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

describe("DanceStyle", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-title")).toHaveTextContent("我是哪種舞蹈");
  });

  it("顯示自訂標題", () => {
    render(<DanceStyle {...defaultProps} config={{ title: "舞蹈個性測驗" }} />);
    expect(screen.getByTestId("dns-title")).toHaveTextContent("舞蹈個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<DanceStyle {...defaultProps} config={{ prompt: "你是什麼舞蹈？" }} />);
    expect(screen.getByTestId("dns-prompt")).toHaveTextContent("你是什麼舞蹈？");
  });

  it("顯示已選人數", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-form")).toBeInTheDocument();
  });

  it("顯示所有舞蹈選項", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-dance-ballet")).toBeInTheDocument();
    expect(screen.getByTestId("dns-dance-hip_hop")).toBeInTheDocument();
    expect(screen.getByTestId("dns-dance-tango")).toBeInTheDocument();
    expect(screen.getByTestId("dns-dance-salsa")).toBeInTheDocument();
  });

  it("未選舞蹈時提交按鈕 disabled", () => {
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-submit-btn")).toBeDisabled();
  });

  it("選舞蹈但理由不足 5 字時提交按鈕 disabled", () => {
    render(<DanceStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dns-dance-ballet"));
    fireEvent.change(screen.getByTestId("dns-reason-input"), { target: { value: "優雅" } });
    expect(screen.getByTestId("dns-submit-btn")).toBeDisabled();
  });

  it("選舞蹈且理由足夠時可提交", () => {
    render(<DanceStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dns-dance-tango"));
    fireEvent.change(screen.getByTestId("dns-reason-input"), { target: { value: "熱情激烈魅力十足" } });
    expect(screen.getByTestId("dns-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<DanceStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dns-dance-breakdance"));
    fireEvent.change(screen.getByTestId("dns-reason-input"), { target: { value: "挑戰極限突破框架" } });
    fireEvent.click(screen.getByTestId("dns-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].dance).toBe("breakdance");
    expect(call.entries[0].reason).toBe("挑戰極限突破框架");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", dance: "flamenco", reason: "熱烈奔放靈魂燃燒" }],
      revealed: false,
    };
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("dns-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<DanceStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("dns-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<DanceStyle {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("dns-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", dance: "waltz", reason: "浪漫優雅輕盈旋轉" }],
      revealed: true,
    };
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-result")).toBeInTheDocument();
    expect(screen.getByTestId("dns-dance-summary")).toBeInTheDocument();
    expect(screen.getByTestId("dns-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示舞蹈徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", dance: "folk", reason: "根植傳統文化連結" }],
      revealed: true,
    };
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-badge-folk")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-ghi", userId: "u1", userName: "Tester", dance: "contemporary", reason: "情感表達詩意流動" }],
      revealed: true,
    };
    render(<DanceStyle {...defaultProps} />);
    expect(screen.getByTestId("dns-card-u1-ghi")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<DanceStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("dns-reveal-btn")).not.toBeInTheDocument();
  });
});
