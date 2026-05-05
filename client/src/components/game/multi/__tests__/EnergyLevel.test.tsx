import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnergyLevel } from "../EnergyLevel";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

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

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

describe("EnergyLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 loading", () => {
    mockIsLoaded = false;
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-title").textContent).toContain("能量值");
    expect(screen.getByTestId("el-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(<EnergyLevel {...defaultProps} config={{ title: "活力指數", prompt: "你的活力幾分？" }} />);
    expect(screen.getByTestId("el-title").textContent).toContain("活力指數");
    expect(screen.getByTestId("el-prompt").textContent).toContain("你的活力幾分？");
  });

  it("顯示提交數量", () => {
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-count").textContent).toContain("0");
  });

  it("顯示 1-5 評分按鈕", () => {
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-scale")).toBeTruthy();
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`el-level-${i}`)).toBeTruthy();
    }
  });

  it("未選擇時提交鈕禁用", () => {
    render(<EnergyLevel {...defaultProps} />);
    expect((screen.getByTestId("el-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選擇後提交鈕啟用", () => {
    render(<EnergyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("el-level-3"));
    expect((screen.getByTestId("el-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("選擇後顯示 emoji", () => {
    render(<EnergyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("el-level-5"));
    expect(screen.getByTestId("el-emoji")).toBeTruthy();
  });

  it("提交呼叫 updateState 帶正確 level", () => {
    render(<EnergyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("el-level-4"));
    fireEvent.click(screen.getByTestId("el-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].level).toBe(4);
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", level: 4, note: "" }],
      revealed: false,
    };
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("el-scale")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<EnergyLevel {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("el-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<EnergyLevel {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("el-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<EnergyLevel {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("el-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示平均值與卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", level: 4, note: "還不錯" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", level: 2, note: "" },
      ],
      revealed: true,
    };
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-result")).toBeTruthy();
    expect(screen.getByTestId("el-avg")).toBeTruthy();
    expect(screen.getByTestId("el-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("el-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<EnergyLevel {...defaultProps} />);
    expect(screen.getByTestId("el-empty")).toBeTruthy();
  });
});
