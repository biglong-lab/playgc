import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObstacleMap } from "../ObstacleMap";

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

describe("ObstacleMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-title").textContent).toContain("障礙地圖");
    expect(screen.getByTestId("om-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(<ObstacleMap {...defaultProps} config={{ title: "卡關清單", prompt: "你被什麼卡住了？" }} />);
    expect(screen.getByTestId("om-title").textContent).toContain("卡關清單");
    expect(screen.getByTestId("om-prompt").textContent).toContain("你被什麼卡住了？");
  });

  it("顯示提交數量", () => {
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-input")).toBeTruthy();
    expect(screen.getByTestId("om-submit-btn")).toBeTruthy();
  });

  it("輸入欄為空時提交鈕禁用", () => {
    render(<ObstacleMap {...defaultProps} />);
    expect((screen.getByTestId("om-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<ObstacleMap {...defaultProps} />);
    fireEvent.change(screen.getByTestId("om-input"), { target: { value: "資訊不透明" } });
    expect((screen.getByTestId("om-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("填寫後點擊提交", () => {
    render(<ObstacleMap {...defaultProps} />);
    fireEvent.change(screen.getByTestId("om-input"), { target: { value: "資訊不透明" } });
    fireEvent.click(screen.getByTestId("om-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].obstacle).toBe("資訊不透明");
  });

  it("已提交顯示我的障礙", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", obstacle: "資訊不透明" }],
      revealed: false,
    };
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("om-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ObstacleMap {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("om-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<ObstacleMap {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("om-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<ObstacleMap {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("om-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示障礙卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", obstacle: "資訊不透明" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", obstacle: "時間不夠" },
      ],
      revealed: true,
    };
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-result")).toBeTruthy();
    expect(screen.getByTestId("om-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("om-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ObstacleMap {...defaultProps} />);
    expect(screen.getByTestId("om-empty")).toBeTruthy();
  });
});
