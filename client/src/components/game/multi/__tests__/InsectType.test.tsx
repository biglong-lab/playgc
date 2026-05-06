import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InsectType } from "../InsectType";

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

describe("InsectType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-title")).toHaveTextContent("我是哪種昆蟲");
  });

  it("顯示自訂標題", () => {
    render(<InsectType {...defaultProps} config={{ title: "昆蟲個性測驗" }} />);
    expect(screen.getByTestId("ins-title")).toHaveTextContent("昆蟲個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<InsectType {...defaultProps} config={{ prompt: "你是什麼昆蟲？" }} />);
    expect(screen.getByTestId("ins-prompt")).toHaveTextContent("你是什麼昆蟲？");
  });

  it("顯示已選人數", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-form")).toBeInTheDocument();
  });

  it("顯示所有昆蟲選項", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-insect-butterfly")).toBeInTheDocument();
    expect(screen.getByTestId("ins-insect-bee")).toBeInTheDocument();
    expect(screen.getByTestId("ins-insect-ladybug")).toBeInTheDocument();
    expect(screen.getByTestId("ins-insect-ant")).toBeInTheDocument();
  });

  it("未選昆蟲時提交按鈕 disabled", () => {
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-submit-btn")).toBeDisabled();
  });

  it("選昆蟲但理由不足 5 字時提交按鈕 disabled", () => {
    render(<InsectType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ins-insect-bee"));
    fireEvent.change(screen.getByTestId("ins-reason-input"), { target: { value: "勤勞" } });
    expect(screen.getByTestId("ins-submit-btn")).toBeDisabled();
  });

  it("選昆蟲且理由足夠時可提交", () => {
    render(<InsectType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ins-insect-butterfly"));
    fireEvent.change(screen.getByTestId("ins-reason-input"), { target: { value: "優雅蛻變翩翩飛舞" } });
    expect(screen.getByTestId("ins-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<InsectType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ins-insect-firefly"));
    fireEvent.change(screen.getByTestId("ins-reason-input"), { target: { value: "黑暗中散發溫柔光芒" } });
    fireEvent.click(screen.getByTestId("ins-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].insect).toBe("firefly");
    expect(call.entries[0].reason).toBe("黑暗中散發溫柔光芒");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", insect: "dragonfly", reason: "靈活敏捷自由飛翔" }],
      revealed: false,
    };
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("ins-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<InsectType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ins-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<InsectType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ins-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", insect: "beetle", reason: "堅硬外殼保護自我" }],
      revealed: true,
    };
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-result")).toBeInTheDocument();
    expect(screen.getByTestId("ins-insect-summary")).toBeInTheDocument();
    expect(screen.getByTestId("ins-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示昆蟲徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", insect: "mantis", reason: "沉著等待精準出擊" }],
      revealed: true,
    };
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-badge-mantis")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-abc", userId: "u1", userName: "Tester", insect: "grasshopper", reason: "彈跳自如節奏律動" }],
      revealed: true,
    };
    render(<InsectType {...defaultProps} />);
    expect(screen.getByTestId("ins-card-u1-abc")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<InsectType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("ins-reveal-btn")).not.toBeInTheDocument();
  });
});
