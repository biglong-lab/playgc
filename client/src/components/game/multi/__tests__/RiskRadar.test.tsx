import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskRadar } from "../RiskRadar";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { risks: [], revealed: false };

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
};

describe("RiskRadar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { risks: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-title").textContent).toContain("風險雷達");
    expect(screen.getByTestId("rr-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <RiskRadar
        {...defaultProps}
        config={{ title: "專案風險掃描", prompt: "你認為最大的威脅是什麼？" }}
      />,
    );
    expect(screen.getByTestId("rr-title").textContent).toContain("專案風險掃描");
    expect(screen.getByTestId("rr-prompt").textContent).toContain("你認為最大的威脅是什麼？");
  });

  it("顯示風險數量", () => {
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-count").textContent).toContain("0");
  });

  it("未提交顯示輸入欄與等級選擇", () => {
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-title-input")).toBeTruthy();
    expect(screen.getByTestId("rr-desc-input")).toBeTruthy();
    expect(screen.getByTestId("rr-level-group")).toBeTruthy();
    expect(screen.getByTestId("rr-submit-btn")).toBeTruthy();
  });

  it("顯示三個風險等級按鈕", () => {
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-level-high")).toBeTruthy();
    expect(screen.getByTestId("rr-level-medium")).toBeTruthy();
    expect(screen.getByTestId("rr-level-low")).toBeTruthy();
  });

  it("標題空白時提交鈕禁用", () => {
    render(<RiskRadar {...defaultProps} />);
    const btn = screen.getByTestId("rr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入標題後提交", () => {
    render(<RiskRadar {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rr-title-input"), {
      target: { value: "預算超支風險" },
    });
    fireEvent.click(screen.getByTestId("rr-level-high"));
    fireEvent.click(screen.getByTestId("rr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.risks[0].title).toBe("預算超支風險");
    expect(arg.risks[0].level).toBe("high");
  });

  it("已提交顯示我的風險，隱藏輸入區", () => {
    mockState = {
      risks: [{ entryId: "u1-1", userId: "u1", userName: "Alice", title: "人力不足", description: "", level: "medium" }],
      revealed: false,
    };
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-my-risk")).toBeTruthy();
    expect(screen.queryByTestId("rr-title-input")).toBeNull();
  });

  it("isTeamLead=true 未揭示時顯示揭示按鈕", () => {
    render(<RiskRadar {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rr-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<RiskRadar {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("rr-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<RiskRadar {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("rr-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示三個分區", () => {
    mockState = {
      risks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", title: "高風A", description: "", level: "high" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", title: "中風B", description: "", level: "medium" },
      ],
      revealed: true,
    };
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-result")).toBeTruthy();
    expect(screen.getByTestId("rr-section-high")).toBeTruthy();
    expect(screen.getByTestId("rr-section-medium")).toBeTruthy();
    expect(screen.getByTestId("rr-section-low")).toBeTruthy();
  });

  it("revealed=true 顯示各風險卡片", () => {
    mockState = {
      risks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", title: "資安漏洞", description: "需立即處理", level: "high" },
      ],
      revealed: true,
    };
    render(<RiskRadar {...defaultProps} />);
    expect(screen.getByTestId("rr-risk-u1-1")).toBeTruthy();
  });
});
