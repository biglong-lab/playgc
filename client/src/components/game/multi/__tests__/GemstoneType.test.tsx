import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GemstoneType } from "../GemstoneType";

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

describe("GemstoneType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-title")).toHaveTextContent("我是哪種寶石");
  });

  it("顯示自訂標題", () => {
    render(<GemstoneType {...defaultProps} config={{ title: "寶石個性測驗" }} />);
    expect(screen.getByTestId("gem-title")).toHaveTextContent("寶石個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<GemstoneType {...defaultProps} config={{ prompt: "你是什麼寶石？" }} />);
    expect(screen.getByTestId("gem-prompt")).toHaveTextContent("你是什麼寶石？");
  });

  it("顯示已選人數", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-form")).toBeInTheDocument();
  });

  it("顯示所有寶石選項", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-gemstone-diamond")).toBeInTheDocument();
    expect(screen.getByTestId("gem-gemstone-ruby")).toBeInTheDocument();
    expect(screen.getByTestId("gem-gemstone-emerald")).toBeInTheDocument();
    expect(screen.getByTestId("gem-gemstone-sapphire")).toBeInTheDocument();
  });

  it("未選寶石時提交按鈕 disabled", () => {
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-submit-btn")).toBeDisabled();
  });

  it("選寶石但理由不足 5 字時提交按鈕 disabled", () => {
    render(<GemstoneType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gem-gemstone-diamond"));
    fireEvent.change(screen.getByTestId("gem-reason-input"), { target: { value: "閃亮" } });
    expect(screen.getByTestId("gem-submit-btn")).toBeDisabled();
  });

  it("選寶石且理由足夠時可提交", () => {
    render(<GemstoneType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gem-gemstone-amethyst"));
    fireEvent.change(screen.getByTestId("gem-reason-input"), { target: { value: "神秘直覺靈感豐富" } });
    expect(screen.getByTestId("gem-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<GemstoneType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gem-gemstone-pearl"));
    fireEvent.change(screen.getByTestId("gem-reason-input"), { target: { value: "純淨優雅歲月磨礪" } });
    fireEvent.click(screen.getByTestId("gem-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].gemstone).toBe("pearl");
    expect(call.entries[0].reason).toBe("純淨優雅歲月磨礪");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", gemstone: "jade", reason: "沉穩圓潤文化底蘊" }],
      revealed: false,
    };
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("gem-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<GemstoneType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("gem-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<GemstoneType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("gem-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", gemstone: "opal", reason: "多彩變化難以捉摸" }],
      revealed: true,
    };
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-result")).toBeInTheDocument();
    expect(screen.getByTestId("gem-gemstone-summary")).toBeInTheDocument();
    expect(screen.getByTestId("gem-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示寶石徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", gemstone: "topaz", reason: "溫暖陽光能量充沛" }],
      revealed: true,
    };
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-badge-topaz")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-xyz", userId: "u1", userName: "Tester", gemstone: "sapphire", reason: "沉靜深邃廣闊視野" }],
      revealed: true,
    };
    render(<GemstoneType {...defaultProps} />);
    expect(screen.getByTestId("gem-card-u1-xyz")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<GemstoneType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("gem-reveal-btn")).not.toBeInTheDocument();
  });
});
