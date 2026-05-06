import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LandscapeType } from "../LandscapeType";

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

describe("LandscapeType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-title")).toHaveTextContent("我是哪種地景");
  });

  it("顯示自訂標題", () => {
    render(<LandscapeType {...defaultProps} config={{ title: "地景個性測驗" }} />);
    expect(screen.getByTestId("lsc-title")).toHaveTextContent("地景個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<LandscapeType {...defaultProps} config={{ prompt: "你是什麼地景？" }} />);
    expect(screen.getByTestId("lsc-prompt")).toHaveTextContent("你是什麼地景？");
  });

  it("顯示已選人數", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-form")).toBeInTheDocument();
  });

  it("顯示所有地景選項", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-landscape-mountain")).toBeInTheDocument();
    expect(screen.getByTestId("lsc-landscape-ocean")).toBeInTheDocument();
    expect(screen.getByTestId("lsc-landscape-forest")).toBeInTheDocument();
    expect(screen.getByTestId("lsc-landscape-desert")).toBeInTheDocument();
  });

  it("未選地景時提交按鈕 disabled", () => {
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-submit-btn")).toBeDisabled();
  });

  it("選地景但理由不足 5 字時提交按鈕 disabled", () => {
    render(<LandscapeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("lsc-landscape-mountain"));
    fireEvent.change(screen.getByTestId("lsc-reason-input"), { target: { value: "高" } });
    expect(screen.getByTestId("lsc-submit-btn")).toBeDisabled();
  });

  it("選地景且理由足夠時可提交", () => {
    render(<LandscapeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("lsc-landscape-ocean"));
    fireEvent.change(screen.getByTestId("lsc-reason-input"), { target: { value: "寬廣深邃包容一切" } });
    expect(screen.getByTestId("lsc-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<LandscapeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("lsc-landscape-forest"));
    fireEvent.change(screen.getByTestId("lsc-reason-input"), { target: { value: "豐盛多元生生不息" } });
    fireEvent.click(screen.getByTestId("lsc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].landscape).toBe("forest");
    expect(call.entries[0].reason).toBe("豐盛多元生生不息");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", landscape: "island", reason: "獨立自足悠然自在" }],
      revealed: false,
    };
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("lsc-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<LandscapeType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("lsc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<LandscapeType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("lsc-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", landscape: "glacier", reason: "純淨冷靜不為所動" }],
      revealed: true,
    };
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-result")).toBeInTheDocument();
    expect(screen.getByTestId("lsc-landscape-summary")).toBeInTheDocument();
    expect(screen.getByTestId("lsc-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示地景徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", landscape: "wetland", reason: "包容多元生態豐富" }],
      revealed: true,
    };
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-badge-wetland")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-vwx", userId: "u1", userName: "Tester", landscape: "canyon", reason: "深邃神秘歲月刻痕" }],
      revealed: true,
    };
    render(<LandscapeType {...defaultProps} />);
    expect(screen.getByTestId("lsc-card-u1-vwx")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<LandscapeType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("lsc-reveal-btn")).not.toBeInTheDocument();
  });
});
