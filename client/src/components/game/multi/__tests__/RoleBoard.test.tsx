import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoleBoard } from "../RoleBoard";

let mockState: Record<string, unknown> = { picks: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

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

beforeEach(() => {
  mockState = { picks: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("RoleBoard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-title").textContent).toBe("我在隊伍中的角色");
  });

  it("顯示自定義標題", () => {
    render(<RoleBoard {...defaultProps} config={{ title: "你是哪種角色？" }} />);
    expect(screen.getByTestId("rlb-title").textContent).toBe("你是哪種角色？");
  });

  it("顯示提示文字", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-prompt")).toBeTruthy();
  });

  it("顯示已選人數", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-count").textContent).toContain("0");
  });

  it("顯示角色選項網格", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-grid")).toBeTruthy();
  });

  it("顯示領導者選項", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-leader")).toBeTruthy();
  });

  it("顯示創意者選項", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-creator")).toBeTruthy();
  });

  it("顯示執行者選項", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-executor")).toBeTruthy();
  });

  it("顯示協調者選項", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-connector")).toBeTruthy();
  });

  it("顯示觀察者選項", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-role-observer")).toBeTruthy();
  });

  it("點選角色後呼叫 updateState", () => {
    render(<RoleBoard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("rlb-role-creator"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      picks: Array<{ userId: string; roleId: string }>;
    };
    expect(newState.picks[0].userId).toBe("u1");
    expect(newState.picks[0].roleId).toBe("creator");
  });

  it("已選後顯示我的選擇區塊", () => {
    mockState = {
      picks: [{ userId: "u1", userName: "Alice", roleId: "executor" }],
      revealed: false,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-my-pick")).toBeTruthy();
  });

  it("已選後隱藏角色選項", () => {
    mockState = {
      picks: [{ userId: "u1", userName: "Alice", roleId: "executor" }],
      revealed: false,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.queryByTestId("rlb-role-grid")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<RoleBoard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rlb-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<RoleBoard {...defaultProps} />);
    expect(screen.queryByTestId("rlb-reveal-btn")).toBeNull();
  });

  it("揭曉後無選擇顯示 rlb-empty", () => {
    mockState = { picks: [], revealed: true };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-empty")).toBeTruthy();
  });

  it("揭曉後有選擇顯示結果區", () => {
    mockState = {
      picks: [
        { userId: "u1", userName: "Alice", roleId: "leader" },
        { userId: "u2", userName: "Bob", roleId: "creator" },
      ],
      revealed: true,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-result")).toBeTruthy();
  });

  it("結果區顯示有選人的角色", () => {
    mockState = {
      picks: [
        { userId: "u1", userName: "Alice", roleId: "leader" },
        { userId: "u2", userName: "Bob", roleId: "creator" },
      ],
      revealed: true,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-result-leader")).toBeTruthy();
    expect(screen.getByTestId("rlb-result-creator")).toBeTruthy();
  });

  it("結果區無人選的角色不顯示", () => {
    mockState = {
      picks: [{ userId: "u1", userName: "Alice", roleId: "leader" }],
      revealed: true,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.queryByTestId("rlb-result-observer")).toBeNull();
  });

  it("結果顯示各角色人數", () => {
    mockState = {
      picks: [
        { userId: "u1", userName: "Alice", roleId: "connector" },
        { userId: "u2", userName: "Bob", roleId: "connector" },
      ],
      revealed: true,
    };
    render(<RoleBoard {...defaultProps} />);
    expect(screen.getByTestId("rlb-result-connector").textContent).toContain("2 人");
  });
});
