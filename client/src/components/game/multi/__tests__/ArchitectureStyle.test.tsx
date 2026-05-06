import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArchitectureStyle } from "../ArchitectureStyle";

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

describe("ArchitectureStyle", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-title")).toHaveTextContent("我是哪種建築風格");
  });

  it("顯示自訂標題", () => {
    render(<ArchitectureStyle {...defaultProps} config={{ title: "建築個性測驗" }} />);
    expect(screen.getByTestId("arc-title")).toHaveTextContent("建築個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<ArchitectureStyle {...defaultProps} config={{ prompt: "你是什麼建築風格？" }} />);
    expect(screen.getByTestId("arc-prompt")).toHaveTextContent("你是什麼建築風格？");
  });

  it("顯示已選人數", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-form")).toBeInTheDocument();
  });

  it("顯示所有建築風格選項", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-arch-modern")).toBeInTheDocument();
    expect(screen.getByTestId("arc-arch-baroque")).toBeInTheDocument();
    expect(screen.getByTestId("arc-arch-minimalist")).toBeInTheDocument();
    expect(screen.getByTestId("arc-arch-gothic")).toBeInTheDocument();
  });

  it("未選建築風格時提交按鈕 disabled", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-submit-btn")).toBeDisabled();
  });

  it("選建築風格但理由不足 5 字時提交按鈕 disabled", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("arc-arch-modern"));
    fireEvent.change(screen.getByTestId("arc-reason-input"), { target: { value: "簡潔" } });
    expect(screen.getByTestId("arc-submit-btn")).toBeDisabled();
  });

  it("選建築風格且理由足夠時可提交", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("arc-arch-japandi"));
    fireEvent.change(screen.getByTestId("arc-reason-input"), { target: { value: "自然溫暖禪意靜好" } });
    expect(screen.getByTestId("arc-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<ArchitectureStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("arc-arch-industrial"));
    fireEvent.change(screen.getByTestId("arc-reason-input"), { target: { value: "裸露坦率不加修飾" } });
    fireEvent.click(screen.getByTestId("arc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].arch).toBe("industrial");
    expect(call.entries[0].reason).toBe("裸露坦率不加修飾");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", arch: "mediterranean", reason: "陽光開朗自由呼吸" }],
      revealed: false,
    };
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("arc-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ArchitectureStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("arc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ArchitectureStyle {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("arc-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", arch: "baroque", reason: "華麗繁複充滿戲劇" }],
      revealed: true,
    };
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-result")).toBeInTheDocument();
    expect(screen.getByTestId("arc-arch-summary")).toBeInTheDocument();
    expect(screen.getByTestId("arc-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示建築風格徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", arch: "art_deco", reason: "幾何奢華黃金年代" }],
      revealed: true,
    };
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-badge-art_deco")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-jkl", userId: "u1", userName: "Tester", arch: "brutalist", reason: "原始粗獷真實有力" }],
      revealed: true,
    };
    render(<ArchitectureStyle {...defaultProps} />);
    expect(screen.getByTestId("arc-card-u1-jkl")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<ArchitectureStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("arc-reveal-btn")).not.toBeInTheDocument();
  });
});
